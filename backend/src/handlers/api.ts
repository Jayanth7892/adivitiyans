import express, { Request, Response } from 'express';
import cors from 'cors';
import serverless from 'serverless-http';
import { db } from '../db';
import { calculateEmployabilityScore } from '../services/employability';
import { runCodingProfileCronSync } from '../services/cronSync';
import { deleteCognitoUsers, deleteAllCognitoUsers } from '../services/cognitoService';
import {
  studentProfileSchema,
  academicSchema,
  codingProfileSchema,
  techSkillSchema,
  certificationSchema,
  softSkillSchema,
  achievementSchema,
  placementProfileSchema,
  REGISTRATION_NUMBER_REGEX,
  RGMCET_EMAIL_REGEX,
} from '../lib/validation';
import { extractAuth, requireAuth, requireRole, requireOwnerOrRole } from '../lib/authMiddleware';
import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 10;

const app = express();
app.use(cors());
app.use(express.json());

// Global auth extraction — runs on every request, NEVER blocks.
// Sets req.auth = { email, role, regNo } or null.
app.use(extractAuth);

import path from 'path';
import fs from 'fs';

const publicDir = path.join(__dirname, '../public');

// Serve frontend static assets from public/ folder if bundled
if (fs.existsSync(publicDir)) {
  app.use('/assets', express.static(path.join(publicDir, 'assets'), { maxAge: '1y', immutable: true }));
  app.use(express.static(publicDir, { maxAge: '1d' }));
}

// ============================================================================
// Health Check
// ============================================================================
app.get('/health', async (_req: Request, res: Response) => {
  const dbHealth = await db.healthCheck();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'advitiyans-api',
    database: dbHealth,
  });
});

// Database Initialization Endpoint
// Protected: requires X-Admin-Secret header matching ADMIN_SECRET env var
app.get('/db-init', async (req: Request, res: Response) => {
  const adminSecret = process.env.ADMIN_SECRET || '';
  if (!adminSecret || req.headers['x-admin-secret'] !== adminSecret) {
    return res.status(403).json({ error: 'Forbidden: missing or invalid X-Admin-Secret header' });
  }
  try {
    const schemaPath = path.resolve(__dirname, '../schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sqlContent = fs.readFileSync(schemaPath, 'utf8');
      await db.query(sqlContent);

      // Delete dummy seed student records if present
      await db.query(`
        DELETE FROM students 
        WHERE email IN ('vikram@rgmcet.edu.in', 'sneha@rgmcet.edu.in', 'rahul@rgmcet.edu.in', 'ananya@rgmcet.edu.in', 'jayanth@rgmcet.edu.in')
        OR roll_number IN ('23091A3253', '23091A3254', '23091A3255');

        DELETE FROM students a USING students b
        WHERE a.ctid < b.ctid AND LOWER(a.roll_number) = LOWER(b.roll_number);

        ALTER TABLE coding_profiles ADD COLUMN IF NOT EXISTS easy_count INT DEFAULT 0;
        ALTER TABLE coding_profiles ADD COLUMN IF NOT EXISTS medium_count INT DEFAULT 0;
        ALTER TABLE coding_profiles ADD COLUMN IF NOT EXISTS hard_count INT DEFAULT 0;
        ALTER TABLE coding_profiles ADD COLUMN IF NOT EXISTS contest_rating INT DEFAULT 0;
      `).catch(() => {/* ignore */});

      // Ensure every real student has a coding profile record (default 0 solved unless set)
      await db.query(`
        INSERT INTO coding_profiles (student_id, platform, handle, streak, score_rating, easy_count, medium_count, hard_count, contest_rating)
        SELECT roll_number, 'LeetCode', LOWER(SPLIT_PART(email, '@', 1)), 0, 0, 0, 0, 0, 0 FROM students
        ON CONFLICT (student_id, platform) DO NOTHING;

        INSERT INTO coding_profiles (student_id, platform, handle, streak, repositories_count)
        SELECT roll_number, 'GitHub', LOWER(SPLIT_PART(email, '@', 1)), 0, 0 FROM students
        ON CONFLICT (student_id, platform) DO NOTHING;
      `).catch(() => {/* ignore */});

      // Migration: add user_sessions table for single-session enforcement
      await db.query(`
        CREATE TABLE IF NOT EXISTS user_sessions (
          email VARCHAR(100) PRIMARY KEY,
          session_token VARCHAR(255) NOT NULL,
          role VARCHAR(20) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
        );
      `).catch(() => {/* ignore if already exists */});

      return res.json({ status: 'ok', message: 'Database cleaned: Dummy users removed, real student profiles synced, user_sessions table ensured.' });

    }
    res.status(404).json({ error: 'schema.sql file not found in asset' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// DB Migrate — Run incremental migrations without needing schema.sql
// Protected: requires X-Admin-Secret header matching ADMIN_SECRET env var
// Runs all ALTER/CREATE IF NOT EXISTS statements that are safe to re-run.
// ============================================================================
app.get('/db-migrate', async (req: Request, res: Response) => {
  const adminSecret = process.env.ADMIN_SECRET || '';
  if (!adminSecret || req.headers['x-admin-secret'] !== adminSecret) {
    return res.status(403).json({ error: 'Forbidden: missing or invalid X-Admin-Secret header' });
  }
  if (db.isMock) {
    return res.json({ status: 'ok', message: 'Mock mode — migrations skipped' });
  }
  try {
    const results: string[] = [];

    // Migration 1: user_sessions table for single-session enforcement
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        email VARCHAR(100) PRIMARY KEY,
        session_token VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
      );
    `);
    results.push('user_sessions table ensured');

    // Migration 2: hod_credentials table for DB-persisted HOD credential override
    await db.query(`
      CREATE TABLE IF NOT EXISTS hod_credentials (
        id SERIAL PRIMARY KEY,
        email VARCHAR(100) NOT NULL,
        password VARCHAR(255) NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    results.push('hod_credentials table ensured');

    // Migration 3: Performance Indexes
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_students_dept_year ON students (department, year);
      CREATE INDEX IF NOT EXISTS idx_academics_student_sem ON academics (student_id, semester);
      CREATE INDEX IF NOT EXISTS idx_coding_profiles_student_platform ON coding_profiles (student_id, platform);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_email_token ON user_sessions (email, session_token);
    `).catch(() => {});
    results.push('performance indexes ensured');

    // Migration 4: Rehash any plain-text student passwords to bcrypt
    // Detects un-hashed entries (bcrypt hashes always start with '$2b$') and upgrades them.
    // Safe to re-run: already-hashed passwords are skipped.
    try {
      const plainPasswords = await db.query(
        `SELECT roll_number, password FROM student_passwords WHERE password NOT LIKE '$2b$%'`
      );
      let rehashed = 0;
      for (const row of plainPasswords.rows) {
        const hash = await bcrypt.hash(String(row.password), BCRYPT_ROUNDS);
        await db.query(
          `UPDATE student_passwords SET password = $1, updated_at = NOW() WHERE roll_number = $2`,
          [hash, row.roll_number]
        );
        rehashed++;
      }
      results.push(`student_passwords: rehashed ${rehashed} plain-text password(s) to bcrypt`);
    } catch {
      results.push('student_passwords: bcrypt rehash skipped (table may not exist yet)');
    }

    return res.json({ status: 'ok', migrations: results });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

function sendIndexHtml(res: Response) {
  const indexPath = path.join(publicDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    const html = fs.readFileSync(indexPath, 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.send(html);
  }
  return res.json({
    service: 'Advitiyans API Backend Server',
    status: 'running',
    healthCheck: '/health',
    message: 'Advitiyans Placement Readiness Platform',
  });
}

// Root & Web UI SPA Fallback Route (Serves frontend index.html over HTTPS)
app.get('/', (_req: Request, res: Response) => {
  return sendIndexHtml(res);
});

// ============================================================================
// Auth: Admin & HOD Login — Server-Side Credential Validation
// Passwords are stored in Lambda env vars (not in frontend code).
// Frontend calls this instead of checking credentials locally.
// ============================================================================
app.post('/auth/admin-login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const emailLower = email.toLowerCase();

    // ── Priority 1: Super admin credentials (DB) ──────────────────────────────
    if (!db.isMock) {
      try {
        const saResult = await db.query(
          'SELECT email, password FROM super_admin_credentials WHERE LOWER(email) = $1',
          [emailLower]
        );
        if (saResult.rows.length > 0) {
          if (saResult.rows[0].password === password) {
            return res.json({ valid: true, role: 'admin', isSuperAdmin: true, email: saResult.rows[0].email });
          }
          // Email matches a super admin but password is wrong → reject immediately
          await new Promise(resolve => setTimeout(resolve, 600));
          return res.status(401).json({ valid: false, error: 'Invalid email or password.' });
        }
      } catch {
        // Table may not exist on first cold-start; fall through to next check
      }

      // ── Priority 2: Regular admin accounts (DB) ───────────────────────────
      try {
        const adminResult = await db.query(
          'SELECT email, name, password FROM admin_accounts WHERE LOWER(email) = $1',
          [emailLower]
        );
        if (adminResult.rows.length > 0) {
          if (adminResult.rows[0].password === password) {
            return res.json({ valid: true, role: 'admin', isSuperAdmin: false, email: adminResult.rows[0].email });
          }
          // Email matches a regular admin but password is wrong → reject immediately
          await new Promise(resolve => setTimeout(resolve, 600));
          return res.status(401).json({ valid: false, error: 'Invalid email or password.' });
        }
      } catch {
        // Table may not exist on first cold-start; fall through
      }
    }

    // ── Priority 3: Legacy env-var admin/HOD (fails closed if env vars not set) ──
    const adminEmail = process.env.ADMIN_MASTER_EMAIL?.toLowerCase();
    const adminPass  = process.env.ADMIN_MASTER_PASS;
    const hodEmail   = process.env.HOD_MASTER_EMAIL?.toLowerCase();
    const hodPass    = process.env.HOD_MASTER_PASS;

    // Brute-force protection: every failed branch now has a minimum 500ms delay
    const failWithDelay = async (msg: string) => {
      await new Promise(resolve => setTimeout(resolve, 500));
      return res.status(401).json({ valid: false, error: msg });
    };

    if (adminEmail && emailLower === adminEmail) {
      if (adminPass && password === adminPass) {
        return res.json({ valid: true, role: 'admin', isSuperAdmin: false, email: adminEmail });
      }
      return failWithDelay('Invalid email or password.');
    }

    // Check DB-persisted HOD credentials first (takes precedence over env vars when set)
    if (!db.isMock) {
      try {
        const hodDbResult = await db.query('SELECT email, password FROM hod_credentials LIMIT 1');
        if (hodDbResult.rows.length > 0) {
          const hodRow = hodDbResult.rows[0];
          if (emailLower === hodRow.email.toLowerCase() && password === hodRow.password) {
            return res.json({ valid: true, role: 'hod', email: hodRow.email });
          }
          // Email matched a DB HOD row but password wrong
          return failWithDelay('Invalid email or password.');
        }
      } catch {
        // hod_credentials table may not exist yet — fall back to env vars
      }
    }

    // Fall back to env var HOD credentials
    if (hodEmail && emailLower === hodEmail) {
      if (hodPass && password === hodPass) {
        return res.json({ valid: true, role: 'hod', email: hodEmail });
      }
      return failWithDelay('Invalid email or password.');
    }

    // Unknown email — delay then reject
    return failWithDelay('Invalid email or password.');
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// Super Admin: Manage Regular Admins
// All endpoints validate the caller is a super admin before proceeding.
// ============================================================================

/** Helper — verify caller_email is a valid super admin */
async function isSuperAdminCaller(callerEmail: string): Promise<boolean> {
  if (!callerEmail || db.isMock) return false;
  try {
    const r = await db.query(
      'SELECT 1 FROM super_admin_credentials WHERE LOWER(email) = LOWER($1)',
      [callerEmail]
    );
    return r.rows.length > 0;
  } catch {
    return false;
  }
}

const SUPER_ADMIN_EMAILS_LOWER = [
  'jayakrushna1622@gmail.com',
  'dineshkumarpathipati@gmail.com',
  'jayanthkumarnaidu777@gmail.com',
];

// GET /super-admin/admins — list all regular admins (email, name, password, created_at)
app.get('/super-admin/admins', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const callerEmail = String(req.query.caller_email || '');
    if (!await isSuperAdminCaller(callerEmail)) {
      return res.status(403).json({ error: 'Super admin access required' });
    }
    const result = await db.query(
      'SELECT email, name, password, created_by, created_at FROM admin_accounts ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /super-admin/admins — create a regular admin
app.post('/super-admin/admins', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { caller_email, name, email, password } = req.body;
    if (!await isSuperAdminCaller(caller_email)) {
      return res.status(403).json({ error: 'Super admin access required' });
    }
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'name, email and password are required' });
    }
    if (String(password).length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }
    // Prevent adding a super admin email as a regular admin
    if (SUPER_ADMIN_EMAILS_LOWER.includes(email.toLowerCase())) {
      return res.status(400).json({ error: 'Cannot create a regular admin account for a super admin email' });
    }
    await db.query(
      `INSERT INTO admin_accounts (email, name, password, created_by, created_at, updated_at)
       VALUES (LOWER($1), $2, $3, LOWER($4), NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET name = $2, password = $3, updated_at = NOW()`,
      [email, name, password, caller_email]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /super-admin/admins/:email — delete a regular admin
app.delete('/super-admin/admins/:email', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { caller_email } = req.body;
    if (!await isSuperAdminCaller(caller_email)) {
      return res.status(403).json({ error: 'Super admin access required' });
    }
    const targetEmail = req.params.email.toLowerCase();
    // Prevent deletion of any super admin email
    if (SUPER_ADMIN_EMAILS_LOWER.includes(targetEmail)) {
      return res.status(400).json({ error: 'Super admin accounts cannot be deleted' });
    }
    await db.query('DELETE FROM admin_accounts WHERE LOWER(email) = $1', [targetEmail]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /super-admin/admins/:email/password — change a regular admin's password
app.put('/super-admin/admins/:email/password', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { caller_email, password } = req.body;
    if (!await isSuperAdminCaller(caller_email)) {
      return res.status(403).json({ error: 'Super admin access required' });
    }
    if (!password || String(password).length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }
    const targetEmail = req.params.email.toLowerCase();
    if (SUPER_ADMIN_EMAILS_LOWER.includes(targetEmail)) {
      return res.status(400).json({ error: 'Use /super-admin/my-password to change a super admin password' });
    }
    await db.query(
      'UPDATE admin_accounts SET password = $1, updated_at = NOW() WHERE LOWER(email) = $2',
      [password, targetEmail]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /super-admin/my-password — super admin changes ONLY their own password
app.put('/super-admin/my-password', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { my_email, new_password } = req.body;
    if (!await isSuperAdminCaller(my_email)) {
      return res.status(403).json({ error: 'Super admin access required' });
    }
    if (!new_password || String(new_password).length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }
    // Updates ONLY the row for my_email — cannot target another super admin
    await db.query(
      'UPDATE super_admin_credentials SET password = $1, updated_at = NOW() WHERE LOWER(email) = LOWER($2)',
      [new_password, my_email]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// Auth: HOD Credential Management
// GET  /auth/hod-credentials       — Admin reads current HOD email & last updated time
// PUT  /auth/hod-credentials       — HOD updates own email/password (requires current password)
// POST /auth/hod-credentials/admin-reset — Admin resets HOD credentials (no current password needed)
// ============================================================================

// GET /auth/hod-credentials — returns current HOD email only (password REDACTED for security)
app.get('/auth/hod-credentials', requireRole('hod', 'admin'), async (_req: Request, res: Response) => {
  try {
    const hodEmailEnv = process.env.HOD_MASTER_EMAIL || null;

    if (db.isMock) {
      return res.json({ email: hodEmailEnv || 'hodcseds@rgmcet.edu.in', password: '••••••', source: 'env', updated_at: null });
    }

    const result = await db.query('SELECT email, updated_at FROM hod_credentials LIMIT 1').catch(() => ({ rows: [] }));
    if (result.rows.length > 0) {
      // Return email + redacted password — never return actual password over API
      return res.json({ email: result.rows[0].email, password: '••••••', source: 'database', updated_at: result.rows[0].updated_at });
    }
    return res.json({ email: hodEmailEnv, password: hodEmailEnv ? '••••••' : null, source: 'env', updated_at: null });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /auth/hod-credentials — HOD updates own email/password (no current password required)
app.put('/auth/hod-credentials', requireRole('hod', 'admin'), async (req: Request, res: Response) => {
  try {
    const { new_email, new_password } = req.body;
    if (!new_email && !new_password) {
      return res.status(400).json({ error: 'Provide at least new_email or new_password to update' });
    }

    const hodEmailEnv = process.env.HOD_MASTER_EMAIL?.toLowerCase() || null;
    const hodPassEnv  = process.env.HOD_MASTER_PASS || null;

    if (db.isMock) {
      return res.json({ success: true, message: 'HOD credentials updated.', email: new_email || hodEmailEnv || '' });
    }

    // Get existing row so we preserve whichever field isn't being changed
    const existing = await db.query('SELECT email, password FROM hod_credentials WHERE id = 1').catch(() => ({ rows: [] }));
    const currentEmail    = existing.rows[0]?.email    || hodEmailEnv || '';
    const currentPassword = existing.rows[0]?.password || hodPassEnv || '';

    const updatedEmail    = new_email    || currentEmail;
    const updatedPassword = new_password || currentPassword;

    // Use explicit id=1 so ON CONFLICT always hits the single HOD row
    await db.query(`
      INSERT INTO hod_credentials (id, email, password, updated_at)
      VALUES (1, $1, $2, NOW())
      ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, password = EXCLUDED.password, updated_at = NOW()
    `, [updatedEmail, updatedPassword]);

    return res.json({ success: true, message: 'HOD credentials updated successfully.', email: updatedEmail });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /auth/hod-credentials/admin-reset — Admin resets HOD credentials (no verification needed)
app.post('/auth/hod-credentials/admin-reset', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { new_email, new_password } = req.body;
    if (!new_email && !new_password) {
      return res.status(400).json({ error: 'Provide at least new_email or new_password' });
    }

    const hodEmailEnv = process.env.HOD_MASTER_EMAIL || null;
    const hodPassEnv  = process.env.HOD_MASTER_PASS  || null;

    if (db.isMock) {
      return res.json({ success: true, message: 'Mock mode: HOD credentials reset.', email: new_email || hodEmailEnv || '' });
    }

    const existing = await db.query('SELECT email, password FROM hod_credentials WHERE id = 1').catch(() => ({ rows: [] }));
    const currentEmail    = existing.rows[0]?.email    || hodEmailEnv || '';
    const currentPassword = existing.rows[0]?.password || hodPassEnv || '';

    const updatedEmail    = new_email    || currentEmail;
    const updatedPassword = new_password || currentPassword;

    await db.query(`
      INSERT INTO hod_credentials (id, email, password, updated_at)
      VALUES (1, $1, $2, NOW())
      ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, password = EXCLUDED.password, updated_at = NOW()
    `, [updatedEmail, updatedPassword]);

    return res.json({ success: true, message: 'HOD credentials reset by admin.', email: updatedEmail });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// Semester Unlock Settings — HOD/Admin controls which semesters students can fill
// ============================================================================

// Mock state for semester unlock (used when DB is unavailable)
const mockSemesterUnlock: Record<string, number> = {
  '1st Year': 0, '2nd Year': 2, '3rd Year': 4, '4th Year': 6,
};

// GET /settings/semester-unlock
app.get('/settings/semester-unlock', async (_req: Request, res: Response) => {
  try {
    if (db.isMock) {
      return res.json(Object.entries(mockSemesterUnlock).map(([year_label, max_semester]) => ({ year_label, max_semester })));
    }
    const result = await db.query(
      `SELECT year_label, max_semester FROM semester_unlock_settings ORDER BY CASE year_label
        WHEN '1st Year' THEN 1 WHEN '2nd Year' THEN 2 WHEN '3rd Year' THEN 3 ELSE 4 END`
    );
    // If table is empty (fresh DB), return defaults
    if (result.rows.length === 0) {
      return res.json([
        { year_label: '1st Year', max_semester: 0 },
        { year_label: '2nd Year', max_semester: 2 },
        { year_label: '3rd Year', max_semester: 4 },
        { year_label: '4th Year', max_semester: 6 },
      ]);
    }
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Per-year minimum semester floors — HOD cannot unlock fewer than these
const YEAR_MIN_SEMESTER: Record<string, number> = {
  '1st Year': 0,
  '2nd Year': 2,
  '3rd Year': 4,
  '4th Year': 6,
};

// Per-year maximum semester ceilings — HOD cannot unlock more than these
const YEAR_MAX_SEMESTER: Record<string, number> = {
  '1st Year': 2,
  '2nd Year': 4,
  '3rd Year': 6,
  '4th Year': 8,
};

// PUT /settings/semester-unlock — HOD/Admin locks or unlocks semesters for a year batch
// When decreasing max_semester, cascade-deletes all academics rows above the new max
// for every student in that year batch (including CGPA recalculation trigger).
app.put('/settings/semester-unlock', requireRole('hod', 'admin'), async (req: Request, res: Response) => {
  try {
    const { year_label, max_semester } = req.body;
    if (!year_label || max_semester === undefined || max_semester === null) {
      return res.status(400).json({ error: 'year_label and max_semester are required' });
    }
    const newMax = Number(max_semester);
    if (isNaN(newMax) || newMax < 0 || newMax > 8) {
      return res.status(400).json({ error: 'max_semester must be between 0 and 8' });
    }

    // Enforce per-year minimum floor
    const minFloor = YEAR_MIN_SEMESTER[year_label] ?? 0;
    if (newMax < minFloor) {
      return res.status(400).json({
        error: `Cannot set max_semester below ${minFloor} for ${year_label}.`,
      });
    }

    // Enforce per-year maximum ceiling
    const maxCeil = YEAR_MAX_SEMESTER[year_label] ?? 8;
    if (newMax > maxCeil) {
      return res.status(400).json({
        error: `Cannot set max_semester above ${maxCeil} for ${year_label}.`,
      });
    }

    if (db.isMock) {
      const oldMax = mockSemesterUnlock[year_label] ?? 0;
      mockSemesterUnlock[year_label] = newMax;
      // In mock mode: also filter out academics above newMax
      let deletedCount = 0;
      if (newMax < oldMax) {
        for (const [rollNo, recs] of db.mockStore.academics.entries()) {
          const before = recs.length;
          const filtered = recs.filter((r: any) => Number(r.semester) <= newMax);
          if (filtered.length !== before) {
            db.mockStore.academics.set(rollNo, filtered);
            deletedCount += before - filtered.length;
          }
        }
      }
      return res.json({ year_label, max_semester: newMax, deleted_count: deletedCount, updated_at: new Date().toISOString() });
    }

    // Get the current max before updating so we know if we're decreasing
    const currentRes = await db.query(
      `SELECT max_semester FROM semester_unlock_settings WHERE year_label = $1`,
      [year_label]
    );
    const oldMax = currentRes.rows.length > 0 ? Number(currentRes.rows[0].max_semester) : newMax;

    // Upsert the new max
    const result = await db.query(
      `INSERT INTO semester_unlock_settings (year_label, max_semester, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (year_label) DO UPDATE SET max_semester = $2, updated_at = NOW()
       RETURNING *`,
      [year_label, newMax]
    );

    let deletedCount = 0;

    // Cascade-delete academics above new max for all students in this year batch
    if (newMax < oldMax) {
      const deleteRes = await db.query(
        `DELETE FROM academics
         WHERE semester > $1
           AND student_id IN (
             SELECT roll_number FROM students WHERE year = $2
           )`,
        [newMax, year_label]
      );
      deletedCount = deleteRes.rowCount ?? 0;
    }

    res.json({ ...result.rows[0], deleted_count: deletedCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// Admin: Student Password Management
// ============================================================================

// GET /admin/student-passwords — admin views students who have passwords set (passwords are REDACTED)
app.get('/admin/student-passwords', requireRole('admin'), async (_req: Request, res: Response) => {
  try {
    if (db.isMock) {
      return res.json([]);
    }
    const result = await db.query(`
      SELECT s.roll_number, s.name, s.email, s.year, s.section,
             CASE WHEN sp.password IS NOT NULL THEN '••••••' ELSE '' END as password,
             sp.updated_at as pwd_updated_at
      FROM students s
      LEFT JOIN student_passwords sp ON s.roll_number = sp.roll_number
      ORDER BY s.roll_number
    `);
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /students/:id/password — admin sets a student's password (stored as bcrypt hash)
app.put('/students/:id/password', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const rollNo = req.params.id.toUpperCase();
    const { password } = req.body;
    if (!password || String(password).length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }
    if (db.isMock) {
      return res.json({ success: true, roll_number: rollNo });
    }
    // Hash password before storage — plain text never hits the database
    const hashedPassword = await bcrypt.hash(String(password), BCRYPT_ROUNDS);
    await db.query(
      `INSERT INTO student_passwords (roll_number, password, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (roll_number) DO UPDATE SET password = $2, updated_at = NOW()`,
      [rollNo, hashedPassword]
    );
    res.json({ success: true, roll_number: rollNo });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// Auth: Faculty/HOD Registration Key Validation (SEC-01 fix)
// The secret key is stored server-side in FACULTY_SECRET_KEY env var.
// Frontend sends the user-entered key here for validation — never exposes it.
// ============================================================================
app.post('/auth/validate-faculty-key', async (req: Request, res: Response) => {
  try {
    const { securityKey } = req.body;
    if (!securityKey) {
      return res.status(400).json({ valid: false, error: 'Security key is required.' });
    }

    const serverKey = process.env.FACULTY_SECRET_KEY;
    if (!serverKey) {
      // Fail closed: if the env var isn't set, registration is disabled (GAP-08)
      console.warn('[AUTH] FACULTY_SECRET_KEY env var is not set. Faculty/HOD registration is disabled.');
      return res.status(503).json({
        valid: false,
        error: 'Faculty registration is currently disabled. Please contact the system administrator to configure the registration key.',
      });
    }

    if (securityKey === serverKey) {
      return res.json({ valid: true });
    }

    // Brute-force delay on failure
    await new Promise(resolve => setTimeout(resolve, 600));
    return res.status(401).json({ valid: false, error: 'Invalid security key. Please contact the department coordinator for the correct key.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// Auth: Check Availability
// ============================================================================
app.get('/auth/check-availability', async (req: Request, res: Response) => {
  try {
    const { type, value } = req.query;
    if (!type || !value) {
      return res.status(400).json({ error: 'type and value query parameters are required' });
    }

    if (type === 'email') {
      const emailStr = String(value).trim().toLowerCase();
      if (!RGMCET_EMAIL_REGEX.test(emailStr)) {
        return res.json({ available: false, message: 'Email must end in @rgmcet.edu.in' });
      }

      if (db.isMock) {
        let taken = false;
        for (const s of db.mockStore.students.values()) {
          if (s.email.toLowerCase() === emailStr) { taken = true; break; }
        }
        return res.json({ available: !taken, message: taken ? 'Email is already registered' : 'Email available' });
      }

      const queryRes = await db.query('SELECT 1 FROM students WHERE LOWER(email) = $1', [emailStr]);
      const taken = queryRes.rows.length > 0;
      return res.json({ available: !taken, message: taken ? 'Email is already registered' : 'Email available' });
    }

    if (type === 'regNo') {
      const regStr = String(value).trim().toUpperCase();
      if (!REGISTRATION_NUMBER_REGEX.test(regStr)) {
        return res.json({ available: false, message: "Must match 10-char format (e.g. 23091A3251 or 23091A32A0). Positions 7-8 must be '32'" });
      }

      if (db.isMock) {
        const taken = db.mockStore.students.has(regStr);
        return res.json({ available: !taken, message: taken ? 'Registration number is already registered' : 'Registration number available' });
      }

      const queryRes = await db.query('SELECT 1 FROM students WHERE UPPER(roll_number) = $1', [regStr]);
      const taken = queryRes.rows.length > 0;
      return res.json({ available: !taken, message: taken ? 'Registration number is already registered' : 'Registration number available' });
    }

    return res.status(400).json({ error: 'Invalid check type' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// Auth: Single-Session Enforcement
// ============================================================================

// POST /auth/session — Register a new session (overwrites any existing one for this email)
// Called by the frontend immediately after a successful Cognito sign-in.
app.post('/auth/session', async (req: Request, res: Response) => {
  try {
    const { email, session_token, role } = req.body;
    if (!email || !session_token || !role) {
      return res.status(400).json({ error: 'email, session_token, and role are required' });
    }

    const emailLower = email.toLowerCase();

    if (db.isMock) {
      // In mock mode just accept without DB
      return res.json({ success: true, message: 'Session registered (mock mode)' });
    }

    // UPSERT: one row per email. Replaces any existing session — old sessions become invalid.
    await db.query(`
      INSERT INTO user_sessions (email, session_token, role, created_at, last_seen, expires_at)
      VALUES ($1, $2, $3, NOW(), NOW(), NOW() + INTERVAL '24 hours')
      ON CONFLICT (email) DO UPDATE
        SET session_token = EXCLUDED.session_token,
            role          = EXCLUDED.role,
            created_at    = NOW(),
            last_seen     = NOW(),
            expires_at    = NOW() + INTERVAL '24 hours'
    `, [emailLower, session_token, role]);

    return res.json({ success: true, message: 'Session registered. Previous sessions (if any) have been invalidated.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /auth/validate-session — Check if a session token is still the active one for this email
// Returns { valid: true } if token matches, { valid: false, reason: '...' } otherwise.
// Frontend polls this every ~30s; if invalid, force-logout with a friendly message.
app.get('/auth/validate-session', async (req: Request, res: Response) => {
  try {
    const { email, session_token } = req.query as { email: string; session_token: string };
    if (!email || !session_token) {
      return res.status(400).json({ error: 'email and session_token query params are required' });
    }

    const emailLower = email.toLowerCase();

    if (db.isMock) {
      return res.json({ valid: true });
    }

    const result = await db.query(
      `SELECT session_token, expires_at FROM user_sessions WHERE email = $1`,
      [emailLower]
    );

    if (result.rows.length === 0) {
      return res.json({ valid: false, reason: 'no_session' });
    }

    const row = result.rows[0];

    if (new Date(row.expires_at) < new Date()) {
      return res.json({ valid: false, reason: 'session_expired' });
    }

    if (row.session_token !== session_token) {
      return res.json({ valid: false, reason: 'session_superseded' });
    }

    // Update last_seen heartbeat
    await db.query(
      `UPDATE user_sessions SET last_seen = NOW() WHERE email = $1`,
      [emailLower]
    ).catch(() => {/* non-critical */});

    return res.json({ valid: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// Students CRUD

// ============================================================================

// GET /students — List/Search/Filter (Guarantees DISTINCT ON roll_number)
app.get('/students', async (req: Request, res: Response) => {
  try {
    const { department, batch, section, year, standing, mentor_id, search } = req.query;

    if (db.isMock) {
      let students = Array.from(db.mockStore.students.values());
      // Deduplicate mock store entries by roll_number
      students = Array.from(new Map(students.map((s) => [s.roll_number.toUpperCase(), s])).values());

      if (department && String(department) !== 'All') students = students.filter((s) => s.department === department);
      if (batch && String(batch) !== 'All') students = students.filter((s) => s.batch === batch);
      if (year && String(year) !== 'All') students = students.filter((s) => s.year === year);
      if (section && String(section) !== 'All') {
        const secFormatted = String(section).replace('Section ', '').replace('Sec ', '');
        students = students.filter((s) => s.section === secFormatted || s.section === `Sec ${secFormatted}`);
      }
      if (mentor_id) students = students.filter((s) => s.faculty_mentor_id === mentor_id);
      if (search) {
        const q = String(search).toLowerCase();
        students = students.filter((s) => s.name.toLowerCase().includes(q) || s.roll_number.toLowerCase().includes(q) || s.email.toLowerCase().includes(q));
      }

      // Dynamically attach computed CGPA and coding profiles to each student
      const enriched = students.map((student) => {
        const rollNo = student.roll_number;
        const academics = db.mockStore.academics.get(rollNo) || [];
        const codingProfiles = db.mockStore.codingProfiles.get(rollNo) || [];

        let cgpa = student.cgpa ? Number(student.cgpa) : 9.0;
        if (academics.length > 0) {
          const sumGpa = academics.reduce((acc: number, a: any) => acc + Number(a.semester_gpa || 0), 0);
          cgpa = Number((sumGpa / academics.length).toFixed(2));
        }

        const lcProfile = codingProfiles.find((p: any) => String(p.platform).toLowerCase() === 'leetcode');
        const ghProfile = codingProfiles.find((p: any) => String(p.platform).toLowerCase() === 'github');

        const computedStanding = cgpa >= 9.0 ? 'First Class with Distinction' : 'First Class';

        return {
          ...student,
          cgpa,
          standing: computedStanding,
          coding_profiles: codingProfiles,
          leetcode_handle: lcProfile?.handle || null,
          leetcode_solved: lcProfile ? (lcProfile.score_rating || lcProfile.streak || 0) : 0,
          github_handle: ghProfile?.handle || null,
          github_repos: ghProfile ? (ghProfile.repositories_count || 0) : 0,
        };
      });

      if (standing && String(standing) !== 'All') {
        return res.json(enriched.filter((s) => s.standing === standing));
      }

      return res.json(enriched);
    }

    // Build dynamic SQL query with DISTINCT ON to eliminate duplicates
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (department && String(department) !== 'All') {
      conditions.push(`department = $${paramIndex++}`);
      params.push(String(department));
    }
    if (batch && String(batch) !== 'All') {
      conditions.push(`batch = $${paramIndex++}`);
      params.push(String(batch));
    }
    if (year && String(year) !== 'All') {
      conditions.push(`year = $${paramIndex++}`);
      params.push(String(year));
    }
    if (section && String(section) !== 'All') {
      const secFormatted = String(section).replace('Section ', '').replace('Sec ', '');
      conditions.push(`(section = $${paramIndex} OR section = $${paramIndex + 1})`);
      params.push(secFormatted, `Sec ${secFormatted}`);
      paramIndex += 2;
    }
    if (mentor_id) {
      conditions.push(`faculty_mentor_id = $${paramIndex++}`);
      params.push(String(mentor_id));
    }
    if (search) {
      const q = `%${String(search).toLowerCase()}%`;
      conditions.push(`(LOWER(name) LIKE $${paramIndex} OR LOWER(roll_number) LIKE $${paramIndex} OR LOWER(email) LIKE $${paramIndex})`);
      params.push(q);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.map(c => c.startsWith('(') ? c : `s.${c}`).join(' AND ')}` : '';
    const result = await db.query(`
      SELECT DISTINCT ON (s.roll_number) 
        s.*,
        COALESCE(ROUND(AVG(a.semester_gpa), 2), 0.00) AS cgpa,
        MAX(CASE WHEN LOWER(c.platform) = 'leetcode' THEN c.handle END) AS leetcode_handle,
        COALESCE(MAX(CASE WHEN LOWER(c.platform) = 'leetcode' THEN GREATEST(c.score_rating, (c.easy_count + c.medium_count + c.hard_count)) END), 0) AS leetcode_solved,
        COALESCE(MAX(CASE WHEN LOWER(c.platform) = 'leetcode' THEN c.easy_count END), 0) AS leetcode_easy,
        COALESCE(MAX(CASE WHEN LOWER(c.platform) = 'leetcode' THEN c.medium_count END), 0) AS leetcode_medium,
        COALESCE(MAX(CASE WHEN LOWER(c.platform) = 'leetcode' THEN c.hard_count END), 0) AS leetcode_hard,
        COALESCE(MAX(CASE WHEN LOWER(c.platform) = 'leetcode' THEN c.contest_rating END), 0) AS leetcode_contest,
        MAX(CASE WHEN LOWER(c.platform) = 'github' THEN c.handle END) AS github_handle,
        COALESCE(MAX(CASE WHEN LOWER(c.platform) = 'github' THEN c.repositories_count END), 0) AS github_repos,
        COALESCE(MAX(CASE WHEN LOWER(c.platform) = 'github' THEN c.followers_count END), 0) AS github_followers,
        COALESCE(MAX(CASE WHEN LOWER(c.platform) = 'github' THEN c.stars_count END), 0) AS github_stars,
        MAX(CASE WHEN LOWER(c.platform) = 'github' THEN c.top_language END) AS github_top_language
      FROM students s
      LEFT JOIN academics a ON a.student_id = s.roll_number
      LEFT JOIN coding_profiles c ON c.student_id = s.roll_number
      ${whereClause}
      GROUP BY s.roll_number, s.name, s.email, s.year, s.phone, s.address, s.native_place, s.department, s.batch, s.section, s.hostel_day_scholar, s.driving_license, s.passport, s.relocation_willingness, s.family_business, s.financial_background, s.faculty_mentor_id, s.photo_url, s.resume_url, s.linkedin_url, s.linkedin_updated, s.created_at, s.updated_at
      ORDER BY s.roll_number, s.created_at DESC
    `, params);
    const formattedRows = result.rows.map((r: any) => ({
      ...r,
      department: (!r.department || r.department === 'CSE' || r.department === 'Data Science' || r.department === 'CSE (Data Science)') ? 'CSE(Data Science)' : r.department,
    }));
    res.json(formattedRows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/students', async (req: Request, res: Response) => {
  try {
    const validatedData = studentProfileSchema.parse(req.body);
    const rawRoll = (validatedData.roll_number || req.body.roll_number || '').toString();
    if (!rawRoll) {
      return res.status(400).json({ error: 'roll_number is required' });
    }
    const regNo = rawRoll.toUpperCase();

    if (db.isMock) {
      if (db.mockStore.students.has(regNo)) {
        return res.status(400).json({ error: 'Student with this registration number already exists' });
      }
      const newStudent = { ...validatedData, roll_number: regNo, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      db.mockStore.students.set(regNo, newStudent);
      return res.status(201).json({ message: 'Student created successfully', student: newStudent });
    }

    const result = await db.query(
      `INSERT INTO students (roll_number, name, email, year, phone, address, native_place, department, batch, section,
        hostel_day_scholar, driving_license, passport, relocation_willingness, family_business, financial_background,
        faculty_mentor_id, photo_url, resume_url, linkedin_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       ON CONFLICT (roll_number) DO UPDATE SET
         name = EXCLUDED.name,
         email = EXCLUDED.email,
         year = EXCLUDED.year,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        regNo, validatedData.name, validatedData.email, validatedData.year || '',
        validatedData.phone || null, validatedData.address || null, validatedData.native_place || null,
        validatedData.department || '', validatedData.batch || '', validatedData.section || '',
        validatedData.hostel_day_scholar || null, validatedData.driving_license || false, validatedData.passport || false,
        validatedData.relocation_willingness || false, validatedData.family_business || null,
        validatedData.financial_background || null, validatedData.faculty_mentor_id || null,
        validatedData.photo_url || null, validatedData.resume_url || null, validatedData.linkedin_url || null,
      ]
    );

    const createdStudent = result.rows[0];

    // Automatically initialize coding profiles & academics for new registration
    await db.query(`
      INSERT INTO coding_profiles (student_id, platform, handle, streak, score_rating, easy_count, medium_count, hard_count, contest_rating)
      VALUES ($1, 'LeetCode', $2, 0, 0, 0, 0, 0, 0)
      ON CONFLICT (student_id, platform) DO NOTHING;

      INSERT INTO coding_profiles (student_id, platform, handle, streak, repositories_count)
      VALUES ($1, 'GitHub', $2, 0, 0)
      ON CONFLICT (student_id, platform) DO NOTHING;
    `, [regNo, regNo.toLowerCase()]).catch(() => {/* ignore */});

    res.status(201).json({ message: 'Student created successfully', student: createdStudent });
  } catch (err: any) {
    res.status(400).json({ error: err.message || err });
  }
});

// POST /students/bulk-import — Bulk Import Students & Marks from CSV/Excel
app.post('/students/bulk-import', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const studentsArray = Array.isArray(req.body) ? req.body : req.body.students;
    if (!Array.isArray(studentsArray) || studentsArray.length === 0) {
      return res.status(400).json({ error: 'Payload must contain a non-empty array of student records.' });
    }

    let importedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < studentsArray.length; i++) {
      const s = studentsArray[i];
      const rawRoll = (s.roll_number || s.regNo || s.registrationNumber || '').toString().trim().toUpperCase();
      if (!rawRoll) {
        errors.push(`Row ${i + 1}: Missing roll number`);
        continue;
      }
      if (!REGISTRATION_NUMBER_REGEX.test(rawRoll)) {
        errors.push(`Row ${i + 1} (${rawRoll}): Invalid registration number format`);
        continue;
      }

      const name = s.name || s.fullName || `Student ${rawRoll}`;
      const email = (s.email || `${rawRoll.toLowerCase()}@rgmcet.edu.in`).toString().trim().toLowerCase();
      const year = s.year || '3rd Year';
      const department = (!s.department || s.department === 'CSE' || s.department === 'Data Science' || s.department === 'CSE (Data Science)') ? 'CSE(Data Science)' : s.department;
      const section = (s.section || 'A').toString().replace(/^Sec\s*/i, '');
      const batch = s.batch || '2023-2027';
      const phone = s.phone || null;
      const cgpa = s.cgpa !== undefined && s.cgpa !== null && s.cgpa !== '' ? Number(s.cgpa) : 0;

      if (db.isMock) {
        const studentObj = { roll_number: rawRoll, name, email, year, department, section, batch, phone, cgpa, updated_at: new Date().toISOString() };
        db.mockStore.students.set(rawRoll, studentObj);
        importedCount++;
        continue;
      }

      await db.query('ALTER TABLE students ADD COLUMN IF NOT EXISTS cgpa NUMERIC(4,2) DEFAULT 0.00;').catch(() => {});

      await db.query(
        `INSERT INTO students (roll_number, name, email, year, phone, department, batch, section, cgpa)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (roll_number) DO UPDATE SET
           name = EXCLUDED.name,
           email = EXCLUDED.email,
           year = EXCLUDED.year,
           department = EXCLUDED.department,
           batch = EXCLUDED.batch,
           section = EXCLUDED.section,
           cgpa = EXCLUDED.cgpa,
           updated_at = CURRENT_TIMESTAMP`,
        [rawRoll, name, email, year, phone, department, batch, section, cgpa]
      );

      // Save academic entry if CGPA provided
      if (cgpa > 0) {
        await db.query(
          `INSERT INTO academics (student_id, semester, semester_gpa, attendance_pct)
           VALUES ($1, 1, $2, 95.0)
           ON CONFLICT (student_id, semester) DO UPDATE SET semester_gpa = EXCLUDED.semester_gpa`,
          [rawRoll, cgpa]
        ).catch(() => {});
      }

      // Ensure default coding profile entries
      await db.query(
        `INSERT INTO coding_profiles (student_id, platform, handle, streak, score_rating, easy_count, medium_count, hard_count, contest_rating)
         VALUES ($1, 'LeetCode', $2, 0, 0, 0, 0, 0, 0)
         ON CONFLICT (student_id, platform) DO NOTHING;

         INSERT INTO coding_profiles (student_id, platform, handle, streak, repositories_count)
         VALUES ($1, 'GitHub', $2, 0, 0)
         ON CONFLICT (student_id, platform) DO NOTHING;`,
        [rawRoll, rawRoll.toLowerCase()]
      ).catch(() => {});

      importedCount++;
    }

    res.json({
      message: `Successfully processed ${importedCount} student records.`,
      importedCount,
      errorsCount: errors.length,
      errors,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Bulk import failed' });
  }
});

// POST /reports/cron-sync — Trigger Background Sync for LeetCode & GitHub Profiles
app.post('/reports/cron-sync', requireRole('admin', 'hod'), async (_req: Request, res: Response) => {
  try {
    const result = await runCodingProfileCronSync();
    res.json({
      message: 'Background coding profile sync completed',
      result,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Cron sync failed' });
  }
});

// GET /students/by-email/:email — Lookup Student by Email
app.get('/students/by-email/:email', async (req: Request, res: Response) => {
  try {
    const emailStr = String(req.params.email).toLowerCase().trim();
    if (db.isMock) {
      for (const s of db.mockStore.students.values()) {
        if (s.email.toLowerCase() === emailStr) return res.json(s);
      }
      return res.status(404).json({ error: 'Student not found with this email' });
    }
    const result = await db.query('SELECT * FROM students WHERE LOWER(email) = $1', [emailStr]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found with this email' });
    }
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /students/:id — Get Student Profile
app.get('/students/:id', async (req: Request, res: Response) => {
  try {
    const studentId = req.params.id.toUpperCase();

    if (db.isMock) {
      const student = db.mockStore.students.get(studentId);
      if (!student) return res.status(404).json({ error: 'Student not found' });
      return res.json(student);
    }

    await db.query('ALTER TABLE students ADD COLUMN IF NOT EXISTS cgpa NUMERIC(4,2) DEFAULT 0.00;').catch(() => {});

    const result = await db.query(
      `SELECT s.*, COALESCE(ROUND(AVG(a.semester_gpa), 2), s.cgpa, 0.00) AS cgpa
       FROM students s
       LEFT JOIN academics a ON a.student_id = s.roll_number
       WHERE UPPER(s.roll_number) = $1
       GROUP BY s.roll_number, s.name, s.email, s.year, s.phone, s.address, s.native_place, s.department, s.batch, s.section, s.hostel_day_scholar, s.driving_license, s.passport, s.relocation_willingness, s.family_business, s.financial_background, s.faculty_mentor_id, s.photo_url, s.resume_url, s.linkedin_url, s.linkedin_updated, s.created_at, s.updated_at, s.cgpa`,
      [studentId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    const student = result.rows[0];
    if (student) {
      student.department = (!student.department || student.department === 'CSE' || student.department === 'Data Science' || student.department === 'CSE (Data Science)') ? 'CSE(Data Science)' : student.department;
    }
    res.json(student);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /students/:id — Update Student Profile (Supports Partial Updates)
app.put('/students/:id', requireOwnerOrRole('id', 'faculty', 'hod', 'admin'), async (req: Request, res: Response) => {
  try {
    const studentId = req.params.id.toUpperCase();
    const body = req.body || {};

    if (db.isMock) {
      const existing = db.mockStore.students.get(studentId) || { roll_number: studentId };
      const rawDept = body.department && body.department !== '' ? body.department : (existing.department || 'CSE(Data Science)');
      const normDept = (!rawDept || rawDept === 'CSE' || rawDept === 'Data Science' || rawDept === 'CSE (Data Science)') ? 'CSE(Data Science)' : rawDept;
      const updated = {
        ...existing,
        ...body,
        department: normDept,
        year: body.year && body.year !== '' ? body.year : (existing.year || '3rd Year'),
        hostel_day_scholar: body.hostel_day_scholar && body.hostel_day_scholar !== '' ? body.hostel_day_scholar : (existing.hostel_day_scholar || 'Day Scholar'),
        cgpa: body.cgpa !== undefined && body.cgpa !== null && body.cgpa !== '' ? Number(body.cgpa) : (existing.cgpa || 0),
        updated_at: new Date().toISOString(),
      };
      db.mockStore.students.set(studentId, updated);
      return res.json({ message: 'Profile updated successfully', student: updated });
    }

    await db.query('ALTER TABLE students ADD COLUMN IF NOT EXISTS cgpa NUMERIC(4,2) DEFAULT 0.00;').catch(() => {});

    // Fetch existing student record to merge partial updates
    const existingRes = await db.query('SELECT * FROM students WHERE UPPER(roll_number) = $1', [studentId]);
    const existing = existingRes.rows[0] || {};

    const name = body.name || existing.name || 'Student';
    const email = body.email || existing.email || `${studentId.toLowerCase()}@rgmcet.edu.in`;
    const year = body.year && body.year !== '' ? body.year : (existing.year || '3rd Year');
    const phone = body.phone !== undefined ? body.phone : (existing.phone || null);
    const address = body.address !== undefined ? body.address : (existing.address || null);
    const native_place = body.native_place !== undefined ? body.native_place : (existing.native_place || null);
    const rawDept = body.department && body.department !== '' ? body.department : (existing.department || 'CSE(Data Science)');
    const department = (!rawDept || rawDept === 'CSE' || rawDept === 'Data Science' || rawDept === 'CSE (Data Science)') ? 'CSE(Data Science)' : rawDept;
    const batch = body.batch && body.batch !== '' ? body.batch : (existing.batch || '2023-2027');
    const section = body.section && body.section !== '' ? body.section : (existing.section || 'A');
    const hostel_day_scholar = body.hostel_day_scholar && body.hostel_day_scholar !== '' ? body.hostel_day_scholar : (existing.hostel_day_scholar || 'Day Scholar');
    const driving_license = body.driving_license !== undefined ? Boolean(body.driving_license) : Boolean(existing.driving_license);
    const passport = body.passport !== undefined ? Boolean(body.passport) : Boolean(existing.passport);
    const relocation_willingness = body.relocation_willingness !== undefined ? Boolean(body.relocation_willingness) : Boolean(existing.relocation_willingness);
    const family_business = body.family_business !== undefined ? body.family_business : (existing.family_business || null);
    const financial_background = body.financial_background !== undefined ? body.financial_background : (existing.financial_background || null);
    const faculty_mentor_id = body.faculty_mentor_id !== undefined ? body.faculty_mentor_id : (existing.faculty_mentor_id || null);
    const photo_url = body.photo_url !== undefined ? body.photo_url : (existing.photo_url || null);
    const resume_url = body.resume_url !== undefined ? body.resume_url : (existing.resume_url || null);
    const linkedin_url = body.linkedin_url !== undefined ? body.linkedin_url : (existing.linkedin_url || null);
    const cgpa = body.cgpa !== undefined && body.cgpa !== null && body.cgpa !== '' ? Number(body.cgpa) : (existing.cgpa || 0);

    let result;
    if (existingRes.rows.length === 0) {
      result = await db.query(
        `INSERT INTO students (roll_number, name, email, year, phone, address, native_place, department, batch, section, hostel_day_scholar, driving_license, passport, relocation_willingness, family_business, financial_background, faculty_mentor_id, photo_url, resume_url, linkedin_url, cgpa)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
         RETURNING *`,
        [studentId, name, email, year, phone, address, native_place, department, batch, section, hostel_day_scholar, driving_license, passport, relocation_willingness, family_business, financial_background, faculty_mentor_id, photo_url, resume_url, linkedin_url, cgpa]
      );
    } else {
      result = await db.query(
        `UPDATE students SET name=$1, email=$2, year=$3, phone=$4, address=$5, native_place=$6,
         department=$7, batch=$8, section=$9, hostel_day_scholar=$10, driving_license=$11,
         passport=$12, relocation_willingness=$13, family_business=$14, financial_background=$15,
         faculty_mentor_id=$16, photo_url=$17, resume_url=$18, linkedin_url=$19, cgpa=$20, updated_at=CURRENT_TIMESTAMP
         WHERE UPPER(roll_number) = $21 RETURNING *`,
        [name, email, year, phone, address, native_place, department, batch, section, hostel_day_scholar, driving_license, passport, relocation_willingness, family_business, financial_background, faculty_mentor_id, photo_url, resume_url, linkedin_url, cgpa, studentId]
      );
    }

    // Recalculate CGPA from all semester records in academics table
    try {
      const acadRes = await db.query(
        'SELECT semester_gpa FROM academics WHERE student_id = $1',
        [studentId]
      );
      if (acadRes.rows.length > 0) {
        const avgCgpa = acadRes.rows.reduce((sum: number, r: any) => sum + Number(r.semester_gpa), 0) / acadRes.rows.length;
        await db.query(
          'UPDATE students SET cgpa = $1 WHERE UPPER(roll_number) = $2',
          [Number(avgCgpa.toFixed(2)), studentId]
        );
      }
    } catch { /* ignore cgpa recalc errors */ }

    res.json({ message: 'Profile updated successfully', student: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message || err });
  }
});

// DELETE /students — Delete ALL students
app.delete('/students', requireRole('admin'), async (_req: Request, res: Response) => {
  try {
    if (db.isMock) {
      db.mockStore.students.clear();
      return res.json({ message: 'All student records cleared from mock store' });
    }

    // Gather emails/rolls BEFORE truncate so we know who to clean up in Cognito
    const allStudents = await db.query('SELECT email, roll_number FROM students').catch(() => ({ rows: [] }));
    const allEmails = allStudents.rows.map((r: any) => r.email).filter(Boolean);
    const allRolls = allStudents.rows.map((r: any) => r.roll_number).filter(Boolean);

    // DB truncate is the authoritative step — must succeed
    await db.query('TRUNCATE TABLE students CASCADE');

    // Cognito cleanup is best-effort: failure must NOT cause a 500
    Promise.allSettled([
      deleteCognitoUsers([...allEmails, ...allRolls]),
      deleteAllCognitoUsers(),
    ]).catch(() => {}); // .catch is a safety net — allSettled never rejects

    res.json({ message: 'All existing student records deleted successfully from database. Cognito cleanup running in background.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /students/:id
app.delete('/students/:id', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const studentId = req.params.id.toUpperCase();

    if (db.isMock) {
      const deleted = db.mockStore.students.delete(studentId);
      if (!deleted) return res.status(404).json({ error: 'Student not found' });
      return res.json({ message: `Student ${studentId} deleted successfully` });
    }

    // Resolve email BEFORE delete for Cognito cleanup
    let studentEmail = `${studentId.toLowerCase()}@rgmcet.edu.in`;
    const existingRes = await db.query('SELECT email FROM students WHERE UPPER(roll_number) = $1', [studentId]);
    if (existingRes.rows.length > 0 && existingRes.rows[0].email) {
      studentEmail = existingRes.rows[0].email.toLowerCase();
    }

    // DB delete is the authoritative step
    const result = await db.query('DELETE FROM students WHERE UPPER(roll_number) = $1 RETURNING roll_number', [studentId]);
    if (result.rows.length === 0) {
      // Not in DB — fire Cognito cleanup anyway, then return 404
      deleteCognitoUsers([studentId, studentEmail]).catch(() => {});
      return res.status(404).json({ error: 'Student not found in database' });
    }

    // Cognito + session cleanup: fire-and-forget so Cognito errors never cause a 500
    deleteCognitoUsers([studentId, studentEmail]).catch(() => {});

    res.json({ message: `Student ${studentId} deleted successfully` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// Bulk Delete Students (Admin)
// ============================================================================

// POST /admin/students/bulk-delete — delete multiple students by roll-number array
app.post('/admin/students/bulk-delete', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { roll_numbers } = req.body;
    if (!Array.isArray(roll_numbers) || roll_numbers.length === 0) {
      return res.status(400).json({ error: 'roll_numbers must be a non-empty array' });
    }
    const ids = roll_numbers.map((r: string) => String(r).toUpperCase());

    if (db.isMock) {
      let deleted = 0;
      ids.forEach((id) => { if (db.mockStore.students.delete(id)) deleted++; });
      return res.json({ deleted, message: `${deleted} student(s) deleted from mock store` });
    }

    // Resolve emails BEFORE delete for Cognito cleanup
    let emailsToDelete: string[] = [];
    const existingRes = await db.query('SELECT email FROM students WHERE UPPER(roll_number) = ANY($1)', [ids]);
    if (existingRes.rows.length > 0) {
      emailsToDelete = existingRes.rows.map((r: any) => r.email).filter(Boolean);
    }

    // DB delete is the authoritative step
    const result = await db.query(
      'DELETE FROM students WHERE UPPER(roll_number) = ANY($1) RETURNING roll_number',
      [ids]
    );
    const deleted = result.rows.length;

    // Cognito + session cleanup: fire-and-forget — Cognito errors must NOT cause a 500
    deleteCognitoUsers([...ids, ...emailsToDelete]).catch(() => {});

    res.json({ deleted, message: `${deleted} student(s) deleted successfully` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// Academics
// ============================================================================
app.get('/students/:id/academics', async (req: Request, res: Response) => {
  try {
    const studentId = req.params.id.toUpperCase();

    if (db.isMock) {
      return res.json(db.mockStore.academics.get(studentId) || []);
    }

    const result = await db.query(
      'SELECT * FROM academics WHERE student_id = $1 ORDER BY semester',
      [studentId]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/students/:id/academics', requireOwnerOrRole('id', 'faculty', 'hod', 'admin'), async (req: Request, res: Response) => {
  try {
    const studentId = req.params.id.toUpperCase();
    const validated = academicSchema.parse(req.body);

    if (db.isMock) {
      const existing = db.mockStore.academics.get(studentId) || [];
      const updated = existing.filter(a => a.semester !== validated.semester);
      updated.push(validated);
      updated.sort((a, b) => a.semester - b.semester);
      db.mockStore.academics.set(studentId, updated);
      return res.json({ message: 'Academic record saved', academics: updated });
    }

    await db.query(
      `INSERT INTO academics (student_id, semester, semester_gpa, programming_grade, attendance_pct, theory_grade, remarks)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (student_id, semester) DO UPDATE SET
         semester_gpa = EXCLUDED.semester_gpa,
         programming_grade = EXCLUDED.programming_grade,
         attendance_pct = EXCLUDED.attendance_pct,
         theory_grade = EXCLUDED.theory_grade,
         remarks = EXCLUDED.remarks,
         updated_at = CURRENT_TIMESTAMP`,
      [studentId, validated.semester, validated.semester_gpa, validated.programming_grade || null,
       validated.attendance_pct, validated.theory_grade || null, validated.remarks || null]
    );

    const result = await db.query(
      'SELECT * FROM academics WHERE student_id = $1 ORDER BY semester',
      [studentId]
    );
    res.json({ message: 'Academic record saved', academics: result.rows });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ============================================================================
// Coding Profiles
// ============================================================================
app.get('/students/:id/coding-profiles', async (req: Request, res: Response) => {
  try {
    const studentId = req.params.id.toUpperCase();

    if (db.isMock) {
      return res.json(db.mockStore.codingProfiles.get(studentId) || []);
    }

    const result = await db.query(
      'SELECT * FROM coding_profiles WHERE student_id = $1 ORDER BY platform',
      [studentId]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/students/:id/coding-profiles', requireOwnerOrRole('id', 'faculty', 'hod', 'admin'), async (req: Request, res: Response) => {
  try {
    const studentId = req.params.id.toUpperCase();
    const validated = codingProfileSchema.parse(req.body);

    if (db.isMock) {
      const existing = db.mockStore.codingProfiles.get(studentId) || [];
      const updated = existing.filter(p => p.platform !== validated.platform);
      updated.push({ ...validated, id: String(Date.now()) });
      db.mockStore.codingProfiles.set(studentId, updated);
      return res.json({ message: 'Coding profile updated', profiles: updated });
    }

    await db.query(
      `INSERT INTO coding_profiles (student_id, platform, handle, streak, score_rating, easy_count, medium_count, hard_count, contest_rating, repositories_count, commits_count, prs_merged)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (student_id, platform) DO UPDATE SET
         handle = EXCLUDED.handle,
         streak = EXCLUDED.streak,
         score_rating = EXCLUDED.score_rating,
         easy_count = EXCLUDED.easy_count,
         medium_count = EXCLUDED.medium_count,
         hard_count = EXCLUDED.hard_count,
         contest_rating = EXCLUDED.contest_rating,
         repositories_count = EXCLUDED.repositories_count,
         commits_count = EXCLUDED.commits_count,
         prs_merged = EXCLUDED.prs_merged,
         last_synced = CURRENT_TIMESTAMP`,
      [studentId, validated.platform, validated.handle, validated.streak,
       validated.score_rating, validated.easy_count || 0, validated.medium_count || 0, validated.hard_count || 0, validated.contest_rating || 0,
       validated.repositories_count, validated.commits_count, validated.prs_merged]
    );

    // If platform is LeetCode, update student's aggregate leetcode_solved score
    if (validated.platform === 'LeetCode') {
      const lcTotal = (validated.score_rating || 0) > 0
        ? validated.score_rating
        : ((validated.easy_count || 0) + (validated.medium_count || 0) + (validated.hard_count || 0));
      await db.query(
        'UPDATE students SET updated_at = CURRENT_TIMESTAMP WHERE UPPER(roll_number) = $1',
        [studentId]
      ).catch(() => {});
    }

    const result = await db.query(
      'SELECT * FROM coding_profiles WHERE student_id = $1 ORDER BY platform',
      [studentId]
    );
    res.json({ message: 'Coding profile updated', profiles: result.rows });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/students/:id/coding-profiles/:platform', requireOwnerOrRole('id', 'faculty', 'hod', 'admin'), async (req: Request, res: Response) => {
  try {
    const studentId = req.params.id.toUpperCase();
    const platform = String(req.params.platform);

    if (db.isMock) {
      const existing = db.mockStore.codingProfiles.get(studentId) || [];
      const updated = existing.filter(p => p.platform.toLowerCase() !== platform.toLowerCase());
      db.mockStore.codingProfiles.set(studentId, updated);
      return res.json({ message: 'Coding profile deleted', profiles: updated });
    }

    await db.query(
      'DELETE FROM coding_profiles WHERE UPPER(student_id) = $1 AND LOWER(platform) = $2',
      [studentId, platform.toLowerCase()]
    );

    const result = await db.query(
      'SELECT * FROM coding_profiles WHERE student_id = $1 ORDER BY platform',
      [studentId]
    );
    res.json({ message: 'Coding profile deleted', profiles: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /proxy/leetcode/:handle — Proxy live LeetCode stats via GraphQL
app.get('/proxy/leetcode/:handle', async (req: Request, res: Response) => {
  try {
    const handle = String(req.params.handle).trim();
    if (!handle) {
      return res.status(400).json({ error: 'Handle is required' });
    }

    const query = `
      query userProblemsSolved($username: String!) {
        matchedUser(username: $username) {
          username
          submitStats: submitStatsGlobal {
            acSubmissionNum {
              difficulty
              count
              submissions
            }
          }
          profile {
            ranking
            reputation
          }
        }
        userContestRanking(username: $username) {
          rating
          globalRanking
          attendedContestsCount
        }
      }
    `;

    const response = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://leetcode.com',
      },
      body: JSON.stringify({ query, variables: { username: handle } }),
    });

    if (!response.ok) {
      return res.status(502).json({ error: `LeetCode API HTTP ${response.status}` });
    }

    const json: any = await response.json();
    const matchedUser = json?.data?.matchedUser;
    if (!matchedUser) {
      return res.status(404).json({ error: 'LeetCode profile not found' });
    }

    const stats = matchedUser.submitStats?.acSubmissionNum || [];
    let easySolved = 0;
    let mediumSolved = 0;
    let hardSolved = 0;
    let totalSolved = 0;

    stats.forEach((s: any) => {
      if (s.difficulty === 'Easy') easySolved = s.count || 0;
      if (s.difficulty === 'Medium') mediumSolved = s.count || 0;
      if (s.difficulty === 'Hard') hardSolved = s.count || 0;
      if (s.difficulty === 'All') totalSolved = s.count || 0;
    });

    if (!totalSolved) {
      totalSolved = easySolved + mediumSolved + hardSolved;
    }

    const contestInfo = json?.data?.userContestRanking || {};

    res.json({
      handle: matchedUser.username || handle,
      totalSolved,
      easySolved,
      mediumSolved,
      hardSolved,
      ranking: matchedUser.profile?.ranking || 0,
      reputation: matchedUser.profile?.reputation || 0,
      contestRating: Math.round(contestInfo.rating || 0),
      attendedContestsCount: contestInfo.attendedContestsCount || 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch LeetCode profile' });
  }
});

// ============================================================================
// Tech Skills
// ============================================================================
app.get('/students/:id/tech-skills', async (req: Request, res: Response) => {
  try {
    const studentId = req.params.id.toUpperCase();

    if (db.isMock) {
      return res.json(db.mockStore.techSkills.get(studentId) || []);
    }

    const result = await db.query(
      'SELECT * FROM tech_skills WHERE student_id = $1 ORDER BY skill_category, specific_tool',
      [studentId]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/students/:id/tech-skills', requireOwnerOrRole('id', 'faculty', 'hod', 'admin'), async (req: Request, res: Response) => {
  try {
    const studentId = req.params.id.toUpperCase();
    const validated = techSkillSchema.parse(req.body);

    if (db.isMock) {
      const existing = db.mockStore.techSkills.get(studentId) || [];
      const updated = existing.filter(s => s.specific_tool !== validated.specific_tool);
      updated.push({ ...validated, id: String(Date.now()) });
      db.mockStore.techSkills.set(studentId, updated);
      return res.json({ message: 'Tech skill added', skills: updated });
    }

    await db.query(
      `INSERT INTO tech_skills (student_id, skill_category, specific_tool, self_rating, verified)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (student_id, specific_tool) DO UPDATE SET
         skill_category = EXCLUDED.skill_category,
         self_rating = EXCLUDED.self_rating,
         verified = EXCLUDED.verified`,
      [studentId, validated.skill_category, validated.specific_tool, validated.self_rating, validated.verified]
    );

    const result = await db.query(
      'SELECT * FROM tech_skills WHERE student_id = $1 ORDER BY skill_category, specific_tool',
      [studentId]
    );
    res.json({ message: 'Tech skill added', skills: result.rows });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ============================================================================
// Certifications
// ============================================================================
app.get('/students/:id/certifications', async (req: Request, res: Response) => {
  try {
    const studentId = req.params.id.toUpperCase();

    if (db.isMock) {
      return res.json(db.mockStore.certifications.get(studentId) || []);
    }

    const result = await db.query(
      'SELECT * FROM certifications WHERE student_id = $1 ORDER BY date_completed DESC NULLS LAST',
      [studentId]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/students/:id/certifications', requireOwnerOrRole('id', 'faculty', 'hod', 'admin'), async (req: Request, res: Response) => {
  try {
    const studentId = req.params.id.toUpperCase();
    const validated = certificationSchema.parse(req.body);

    if (db.isMock) {
      const existing = db.mockStore.certifications.get(studentId) || [];
      existing.push({ ...validated, id: String(Date.now()) });
      db.mockStore.certifications.set(studentId, existing);
      return res.json({ message: 'Certification added', certifications: existing });
    }

    await db.query(
      `INSERT INTO certifications (student_id, provider, title, date_completed, certificate_file_url, suggested)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [studentId, validated.provider, validated.title, validated.date_completed || null,
       validated.certificate_file_url || null, validated.suggested]
    );

    const result = await db.query(
      'SELECT * FROM certifications WHERE student_id = $1 ORDER BY date_completed DESC NULLS LAST',
      [studentId]
    );
    res.json({ message: 'Certification added', certifications: result.rows });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/students/:id/certifications/:certId', requireOwnerOrRole('id', 'faculty', 'hod', 'admin'), async (req: Request, res: Response) => {
  try {
    const studentId = req.params.id.toUpperCase();
    const certId = req.params.certId;
    const validated = certificationSchema.parse(req.body);

    if (db.isMock) {
      const existing = db.mockStore.certifications.get(studentId) || [];
      const idx = existing.findIndex((c: any) => c.id === certId);
      if (idx >= 0) existing[idx] = { ...existing[idx], ...validated };
      db.mockStore.certifications.set(studentId, existing);
      return res.json({ message: 'Certification updated', certifications: existing });
    }

    await db.query(
      `UPDATE certifications SET provider = $1, title = $2, date_completed = $3, certificate_file_url = $4, suggested = $5
       WHERE id = $6 AND student_id = $7`,
      [validated.provider, validated.title, validated.date_completed || null,
       validated.certificate_file_url || null, validated.suggested, certId, studentId]
    );

    const result = await db.query(
      'SELECT * FROM certifications WHERE student_id = $1 ORDER BY date_completed DESC NULLS LAST',
      [studentId]
    );
    res.json({ message: 'Certification updated', certifications: result.rows });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/students/:id/certifications/:certId', requireOwnerOrRole('id', 'faculty', 'hod', 'admin'), async (req: Request, res: Response) => {
  try {
    const studentId = req.params.id.toUpperCase();
    const certId = req.params.certId;

    if (db.isMock) {
      const existing = db.mockStore.certifications.get(studentId) || [];
      const updated = existing.filter((c: any) => c.id !== certId);
      db.mockStore.certifications.set(studentId, updated);
      return res.json({ message: 'Certification deleted', certifications: updated });
    }

    await db.query(
      'DELETE FROM certifications WHERE id = $1 AND student_id = $2',
      [certId, studentId]
    );

    const result = await db.query(
      'SELECT * FROM certifications WHERE student_id = $1 ORDER BY date_completed DESC NULLS LAST',
      [studentId]
    );
    res.json({ message: 'Certification deleted', certifications: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// Soft Skills
// ============================================================================
app.get('/students/:id/soft-skills', async (req: Request, res: Response) => {
  try {
    const studentId = req.params.id.toUpperCase();

    if (db.isMock) {
      return res.json(db.mockStore.softSkills.get(studentId) || []);
    }

    const result = await db.query(
      'SELECT * FROM soft_skills WHERE student_id = $1 ORDER BY skill',
      [studentId]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/students/:id/soft-skills', requireOwnerOrRole('id', 'faculty', 'hod', 'admin'), async (req: Request, res: Response) => {
  try {
    const studentId = req.params.id.toUpperCase();
    const validated = softSkillSchema.parse(req.body);

    if (db.isMock) {
      const existing = db.mockStore.softSkills.get(studentId) || [];
      const updated = existing.filter(s => !(s.skill === validated.skill && s.rated_by === validated.rated_by));
      updated.push(validated);
      db.mockStore.softSkills.set(studentId, updated);
      return res.json({ message: 'Soft skill rating saved', softSkills: updated });
    }

    await db.query(
      `INSERT INTO soft_skills (student_id, skill, rating, rated_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (student_id, skill, rated_by) DO UPDATE SET
         rating = EXCLUDED.rating,
         updated_at = CURRENT_TIMESTAMP`,
      [studentId, validated.skill, validated.rating, validated.rated_by]
    );

    const result = await db.query(
      'SELECT * FROM soft_skills WHERE student_id = $1 ORDER BY skill',
      [studentId]
    );
    res.json({ message: 'Soft skill rating saved', softSkills: result.rows });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ============================================================================
// Achievements
// ============================================================================
app.get('/students/:id/achievements', async (req: Request, res: Response) => {
  try {
    const studentId = req.params.id.toUpperCase();

    if (db.isMock) {
      return res.json(db.mockStore.achievements.get(studentId) || []);
    }

    const result = await db.query(
      'SELECT * FROM achievements WHERE student_id = $1 ORDER BY achievement_date DESC NULLS LAST',
      [studentId]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/students/:id/achievements', requireOwnerOrRole('id', 'faculty', 'hod', 'admin'), async (req: Request, res: Response) => {
  try {
    const studentId = req.params.id.toUpperCase();
    const validated = achievementSchema.parse(req.body);

    if (db.isMock) {
      const existing = db.mockStore.achievements.get(studentId) || [];
      existing.unshift({ ...validated, id: String(Date.now()) });
      db.mockStore.achievements.set(studentId, existing);
      return res.json({ message: 'Achievement added', achievements: existing });
    }

    await db.query(
      `INSERT INTO achievements (student_id, type, title, description, achievement_date, organization)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [studentId, validated.type, validated.title, validated.description,
       validated.achievement_date || null, validated.organization || null]
    );

    const result = await db.query(
      'SELECT * FROM achievements WHERE student_id = $1 ORDER BY achievement_date DESC NULLS LAST',
      [studentId]
    );
    res.json({ message: 'Achievement added', achievements: result.rows });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ============================================================================
// Placement Profile
// ============================================================================
app.get('/students/:id/placement-profile', async (req: Request, res: Response) => {
  try {
    const studentId = req.params.id.toUpperCase();

    if (db.isMock) {
      const placement = db.mockStore.placement.get(studentId);
      return res.json(placement || {});
    }

    const result = await db.query(
      'SELECT * FROM placement_profile WHERE student_id = $1',
      [studentId]
    );
    res.json(result.rows[0] || {});
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/students/:id/placement-profile', requireOwnerOrRole('id', 'faculty', 'hod', 'admin'), async (req: Request, res: Response) => {
  try {
    const studentId = req.params.id.toUpperCase();
    const validated = placementProfileSchema.parse(req.body);

    if (db.isMock) {
      const existing = db.mockStore.placement.get(studentId) || {};
      const updated = { ...existing, ...validated, student_id: studentId, updated_at: new Date().toISOString() };
      db.mockStore.placement.set(studentId, updated);
      return res.json({ message: 'Placement preferences saved', placement: updated });
    }

    const result = await db.query(
      `INSERT INTO placement_profile (student_id, placement_category, preferred_career, dream_company, higher_studies_interest, need_from_department)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (student_id) DO UPDATE SET
         placement_category = EXCLUDED.placement_category,
         preferred_career = EXCLUDED.preferred_career,
         dream_company = EXCLUDED.dream_company,
         higher_studies_interest = EXCLUDED.higher_studies_interest,
         need_from_department = EXCLUDED.need_from_department,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [studentId, validated.placement_category, validated.preferred_career,
       validated.dream_company, validated.higher_studies_interest, validated.need_from_department || null]
    );
    res.json({ message: 'Placement preferences saved', placement: result.rows[0] });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ============================================================================
// Employability Score
// ============================================================================
app.get('/students/:id/employability-score', async (req: Request, res: Response) => {
  try {
    const studentId = req.params.id.toUpperCase();

    if (db.isMock) {
      const academics = db.mockStore.academics.get(studentId) || [];
      const codingProfiles = db.mockStore.codingProfiles.get(studentId) || [];
      const techSkills = db.mockStore.techSkills.get(studentId) || [];
      const certifications = db.mockStore.certifications.get(studentId) || [];
      const softSkills = db.mockStore.softSkills.get(studentId) || [];
      const achievements = db.mockStore.achievements.get(studentId) || [];
      return res.json(calculateEmployabilityScore({ academics, codingProfiles, techSkills, certifications, softSkills, achievements }));
    }

    const [academicsRes, codingRes, skillsRes, certsRes, softRes, achieveRes] = await Promise.all([
      db.query('SELECT * FROM academics WHERE student_id = $1', [studentId]),
      db.query('SELECT * FROM coding_profiles WHERE student_id = $1', [studentId]),
      db.query('SELECT * FROM tech_skills WHERE student_id = $1', [studentId]),
      db.query('SELECT * FROM certifications WHERE student_id = $1', [studentId]),
      db.query('SELECT * FROM soft_skills WHERE student_id = $1', [studentId]),
      db.query('SELECT * FROM achievements WHERE student_id = $1', [studentId]),
    ]);

    const scoreData = calculateEmployabilityScore({
      academics: academicsRes.rows,
      codingProfiles: codingRes.rows,
      techSkills: skillsRes.rows,
      certifications: certsRes.rows,
      softSkills: softRes.rows,
      achievements: achieveRes.rows,
    });
    res.json(scoreData);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// Upload URL (S3 Pre-signed URL) — Real pre-signed URL generation
// ============================================================================
app.get('/students/:id/upload-url', async (req: Request, res: Response) => {
  try {
    const { fileName, uploadType } = req.query;
    const studentId = req.params.id.toUpperCase();
    const fileKey = `students/${studentId}/${uploadType || 'docs'}/${Date.now()}_${fileName || 'file.pdf'}`;
    const bucketName = process.env.UPLOADS_BUCKET_NAME;

    if (!bucketName) {
      // Fallback for local dev without S3
      return res.json({
        uploadUrl: `https://placeholder-no-bucket.s3.amazonaws.com/${fileKey}`,
        viewUrl: `https://placeholder-no-bucket.s3.amazonaws.com/${fileKey}`,
        fileKey,
        expiresInSeconds: 300,
        warning: 'UPLOADS_BUCKET_NAME not set — using placeholder URL',
      });
    }

    const { S3Client, PutObjectCommand, GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

    const s3Client = new S3Client({});

    // Generate PUT pre-signed URL for upload
    const putCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileKey,
      ContentType: 'application/octet-stream',
    });
    const uploadUrl = await getSignedUrl(s3Client, putCommand, { expiresIn: 300 });

    // Generate GET pre-signed URL for viewing the file after upload
    const getCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: fileKey,
    });
    const viewUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });

    res.json({
      uploadUrl,
      viewUrl,
      fileKey,
      expiresInSeconds: 300,
    });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to generate pre-signed URL: ${err.message}` });
  }
});

// View/Download URL for existing files
app.get('/students/:id/view-url', async (req: Request, res: Response) => {
  try {
    const { fileKey } = req.query;
    const bucketName = process.env.UPLOADS_BUCKET_NAME;

    if (!fileKey || !bucketName) {
      return res.status(400).json({ error: 'fileKey query param and UPLOADS_BUCKET_NAME are required' });
    }

    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

    const s3Client = new S3Client({});
    const getCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: String(fileKey),
    });
    const viewUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });

    res.json({ viewUrl, expiresInSeconds: 3600 });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to generate view URL: ${err.message}` });
  }
});

// ============================================================================
// Faculty: Registration & Mentees
// ============================================================================

// POST /faculty — Register a new faculty profile
app.post('/faculty', async (req: Request, res: Response) => {
  try {
    const { faculty_id, name, email, department, role } = req.body;
    const facId = (faculty_id || `FAC${Date.now().toString().slice(-4)}`).toUpperCase();

    if (db.isMock) {
      const newFaculty = { faculty_id: facId, name, email, department: department || 'CSE', role: role || 'mentor' };
      return res.status(201).json({ message: 'Faculty registered successfully', faculty: newFaculty });
    }

    const result = await db.query(
      `INSERT INTO faculty (faculty_id, name, email, department, role)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE SET name=$2, department=$4, role=$5
       RETURNING *`,
      [facId, name, email.toLowerCase(), department || 'CSE', role || 'mentor']
    );
    res.status(201).json({ message: 'Faculty registered successfully', faculty: result.rows[0] });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /faculty/by-email/:email — Fetch faculty profile by email
app.get('/faculty/by-email/:email', async (req: Request, res: Response) => {
  try {
    const email = req.params.email.toLowerCase();
    if (db.isMock) {
      return res.json({ faculty_id: 'FAC001', name: 'Dr. M. V. Ramana', email, department: 'CSE', role: 'mentor' });
    }
    const result = await db.query('SELECT * FROM faculty WHERE LOWER(email) = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Faculty profile not found' });
    }
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/faculty/:id/mentees', async (req: Request, res: Response) => {
  try {
    const facultyId = req.params.id.toUpperCase();

    if (db.isMock) {
      const students = Array.from(db.mockStore.students.values()).filter(
        (s) => s.faculty_mentor_id === facultyId || facultyId === 'FAC001'
      );
      return res.json(students);
    }

    const result = await db.query(
      `SELECT s.*,
              COALESCE(ROUND(AVG(a.semester_gpa), 2), 0.00) AS cgpa,
              MAX(CASE WHEN LOWER(c.platform) = 'leetcode' THEN c.handle END) AS leetcode_handle,
              COALESCE(MAX(CASE WHEN LOWER(c.platform) = 'leetcode' THEN c.score_rating END), 0) AS leetcode_solved,
              MAX(CASE WHEN LOWER(c.platform) = 'github' THEN c.handle END) AS github_handle,
              COALESCE(MAX(CASE WHEN LOWER(c.platform) = 'github' THEN c.repositories_count END), 0) AS github_repos
       FROM students s
       LEFT JOIN academics a ON a.student_id = s.roll_number
       LEFT JOIN coding_profiles c ON c.student_id = s.roll_number
       WHERE s.faculty_mentor_id = $1
       GROUP BY s.roll_number, s.name, s.email, s.year, s.phone, s.address, s.native_place, s.department, s.batch, s.section, s.hostel_day_scholar, s.driving_license, s.passport, s.relocation_willingness, s.family_business, s.financial_background, s.faculty_mentor_id, s.photo_url, s.resume_url, s.linkedin_url, s.linkedin_updated, s.created_at, s.updated_at
       ORDER BY s.roll_number`,
      [facultyId]
    );
    const formattedRows = result.rows.map((r: any) => ({
      ...r,
      department: (!r.department || r.department === 'CSE' || r.department === 'Data Science' || r.department === 'CSE (Data Science)') ? 'CSE(Data Science)' : r.department,
    }));
    res.json(formattedRows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// ============================================================================
// Reports: HOD Analytics
// ============================================================================
app.get('/reports/hod-analytics', async (_req: Request, res: Response) => {
  try {
    if (db.isMock) {
      return res.json({
        department: 'Computer Science & Engineering (CSE)',
        totalStudents: 470,
        yearBreakdown: [
          { year: '1st Year', avgCgpa: 8.85, students: 120, distinction: 42, firstClass: 55, secondClass: 18 },
          { year: '2nd Year', avgCgpa: 8.95, students: 115, distinction: 45, firstClass: 50, secondClass: 15 },
          { year: '3rd Year', avgCgpa: 9.12, students: 125, distinction: 54, firstClass: 55, secondClass: 13 },
          { year: '4th Year', avgCgpa: 9.25, students: 110, distinction: 52, firstClass: 46, secondClass: 10 },
        ],
        sectionBreakdown: [
          { section: 'Section A', avgCgpa: 9.15, students: 155, distinction: 68 },
          { section: 'Section B', avgCgpa: 9.02, students: 160, distinction: 64 },
          { section: 'Section C', avgCgpa: 8.95, students: 155, distinction: 61 },
        ],
        topRankers: Array.from(db.mockStore.students.values()).slice(0, 5),
      });
    }

    // Real aggregation queries
    const totalRes = await db.query(
      "SELECT COUNT(*) as count FROM students WHERE department = 'CSE'"
    );

    const yearRes = await db.query(
      `SELECT s.year,
              COUNT(*) as students,
              ROUND(AVG(a.avg_gpa)::numeric, 2) as "avgCgpa",
              COUNT(*) FILTER (WHERE a.avg_gpa >= 9.0) as distinction,
              COUNT(*) FILTER (WHERE a.avg_gpa >= 7.0 AND a.avg_gpa < 9.0) as "firstClass",
              COUNT(*) FILTER (WHERE a.avg_gpa >= 5.0 AND a.avg_gpa < 7.0) as "secondClass"
       FROM students s
       LEFT JOIN (SELECT student_id, AVG(semester_gpa) as avg_gpa FROM academics GROUP BY student_id) a
         ON s.roll_number = a.student_id
       WHERE s.department = 'CSE'
       GROUP BY s.year
       ORDER BY s.year`
    );

    const sectionRes = await db.query(
      `SELECT 'Section ' || s.section as section,
              COUNT(*) as students,
              ROUND(AVG(a.avg_gpa)::numeric, 2) as "avgCgpa",
              COUNT(*) FILTER (WHERE a.avg_gpa >= 9.0) as distinction
       FROM students s
       LEFT JOIN (SELECT student_id, AVG(semester_gpa) as avg_gpa FROM academics GROUP BY student_id) a
         ON s.roll_number = a.student_id
       WHERE s.department = 'CSE'
       GROUP BY s.section
       ORDER BY s.section`
    );

    const topRes = await db.query(
      `SELECT s.*, ROUND(AVG(a.semester_gpa)::numeric, 2) as avg_gpa
       FROM students s
       JOIN academics a ON s.roll_number = a.student_id
       WHERE s.department = 'CSE'
       GROUP BY s.roll_number
       ORDER BY avg_gpa DESC
       LIMIT 5`
    );

    res.json({
      department: 'Computer Science & Engineering (CSE)',
      totalStudents: parseInt(totalRes.rows[0]?.count || '0'),
      yearBreakdown: yearRes.rows,
      sectionBreakdown: sectionRes.rows,
      topRankers: topRes.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// Reports: Department
// ============================================================================
app.get('/reports/department/:dept', async (req: Request, res: Response) => {
  try {
    const dept = req.params.dept.toUpperCase();
    const { year, section } = req.query;

    if (db.isMock) {
      let students = Array.from(db.mockStore.students.values()).filter((s) => s.department === dept);
      if (year && String(year) !== 'All') students = students.filter((s) => s.year === year);
      if (section && String(section) !== 'All') {
        const secFormatted = String(section).replace('Section ', '').replace('Sec ', '');
        students = students.filter((s) => s.section === secFormatted || s.section === `Sec ${secFormatted}`);
      }
      return res.json({
        department: dept, totalStudents: students.length || 5, avgGpa: 9.15,
        avgEmployabilityScore: 88.5, eligibleForPlacementCount: students.length || 5,
        topSkills: ['Claude Code & CrewAI', 'React & TypeScript', 'AWS Lambda & S3'],
      });
    }

    const conditions: string[] = ['s.department = $1'];
    const params: any[] = [dept];
    let paramIndex = 2;

    if (year && String(year) !== 'All') {
      conditions.push(`s.year = $${paramIndex++}`);
      params.push(String(year));
    }
    if (section && String(section) !== 'All') {
      const secFormatted = String(section).replace('Section ', '').replace('Sec ', '');
      conditions.push(`(s.section = $${paramIndex} OR s.section = $${paramIndex + 1})`);
      params.push(secFormatted, `Sec ${secFormatted}`);
      paramIndex += 2;
    }

    const whereClause = conditions.join(' AND ');

    const statsRes = await db.query(
      `SELECT COUNT(*) as total_students,
              ROUND(AVG(a.avg_gpa)::numeric, 2) as avg_gpa
       FROM students s
       LEFT JOIN (SELECT student_id, AVG(semester_gpa) as avg_gpa FROM academics GROUP BY student_id) a
         ON s.roll_number = a.student_id
       WHERE ${whereClause}`,
      params
    );

    const skillsRes = await db.query(
      `SELECT ts.specific_tool, COUNT(*) as cnt
       FROM tech_skills ts
       JOIN students s ON ts.student_id = s.roll_number
       WHERE ${whereClause}
       GROUP BY ts.specific_tool
       ORDER BY cnt DESC LIMIT 3`,
      params
    );

    const stats = statsRes.rows[0] || {};
    res.json({
      department: dept,
      totalStudents: parseInt(stats.total_students || '0'),
      avgGpa: parseFloat(stats.avg_gpa || '0'),
      avgEmployabilityScore: 0,
      eligibleForPlacementCount: parseInt(stats.total_students || '0'),
      topSkills: skillsRes.rows.map((r: any) => r.specific_tool),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// Reports: Placement Summary
// ============================================================================
app.get('/reports/placement-summary', async (_req: Request, res: Response) => {
  try {
    if (db.isMock) {
      const students = Array.from(db.mockStore.students.values());
      return res.json({
        summary: {
          totalRegistered: students.length, placementEligible: students.length,
          avgEmployabilityScore: 89.2,
          topDreamCompanies: ['Google', 'Microsoft', 'Amazon', 'Atlassian', 'AWS'],
        },
        students,
      });
    }

    const studentsRes = await db.query('SELECT * FROM students ORDER BY roll_number');
    const summaryRes = await db.query(
      `SELECT COUNT(*) as total,
              ROUND(AVG(pp.employability_score)::numeric, 1) as avg_score
       FROM students s
       LEFT JOIN placement_profile pp ON s.roll_number = pp.student_id`
    );

    const companiesRes = await db.query(
      `SELECT UNNEST(dream_company) as company, COUNT(*) as cnt
       FROM placement_profile
       GROUP BY company
       ORDER BY cnt DESC LIMIT 5`
    );

    const summary = summaryRes.rows[0] || {};
    res.json({
      summary: {
        totalRegistered: parseInt(summary.total || '0'),
        placementEligible: parseInt(summary.total || '0'),
        avgEmployabilityScore: parseFloat(summary.avg_score || '0'),
        topDreamCompanies: companiesRes.rows.map((r: any) => r.company),
      },
      students: studentsRes.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Catch-all SPA route fallback for client-side React routes
app.get('*', (_req: Request, res: Response) => {
  return sendIndexHtml(res);
});

export const handler = serverless(app);
export default app;
