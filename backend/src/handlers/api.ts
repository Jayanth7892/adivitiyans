import express, { Request, Response } from 'express';
import cors from 'cors';
import serverless from 'serverless-http';
import { db } from '../db';
import { calculateEmployabilityScore } from '../services/employability';
import { runCodingProfileCronSync } from '../services/cronSync';
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

const app = express();
app.use(cors());
app.use(express.json());

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
app.get('/db-init', async (_req: Request, res: Response) => {
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

      return res.json({ status: 'ok', message: 'Database cleaned: Dummy users removed and real student profiles synced.' });
    }
    res.status(404).json({ error: 'schema.sql file not found in asset' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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
        COALESCE(MAX(CASE WHEN LOWER(c.platform) = 'leetcode' THEN c.score_rating END), 0) AS leetcode_solved,
        COALESCE(MAX(CASE WHEN LOWER(c.platform) = 'leetcode' THEN c.easy_count END), 0) AS leetcode_easy,
        COALESCE(MAX(CASE WHEN LOWER(c.platform) = 'leetcode' THEN c.medium_count END), 0) AS leetcode_medium,
        COALESCE(MAX(CASE WHEN LOWER(c.platform) = 'leetcode' THEN c.hard_count END), 0) AS leetcode_hard,
        COALESCE(MAX(CASE WHEN LOWER(c.platform) = 'leetcode' THEN c.contest_rating END), 0) AS leetcode_contest,
        MAX(CASE WHEN LOWER(c.platform) = 'github' THEN c.handle END) AS github_handle,
        COALESCE(MAX(CASE WHEN LOWER(c.platform) = 'github' THEN c.repositories_count END), 0) AS github_repos
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
app.post('/students/bulk-import', async (req: Request, res: Response) => {
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
app.post('/reports/cron-sync', async (_req: Request, res: Response) => {
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
app.put('/students/:id', async (req: Request, res: Response) => {
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

    // Also update academics table if cgpa is updated
    if (body.cgpa !== undefined && body.cgpa !== null && body.cgpa !== '' && Number(body.cgpa) > 0) {
      await db.query(
        `INSERT INTO academics (student_id, semester, semester_gpa, attendance_pct)
         VALUES ($1, 1, $2, 95.0)
         ON CONFLICT (student_id, semester) DO UPDATE SET semester_gpa = EXCLUDED.semester_gpa`,
        [studentId, Number(body.cgpa)]
      ).catch(() => {});
    }

    res.json({ message: 'Profile updated successfully', student: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message || err });
  }
});

// DELETE /students — Delete ALL students
app.delete('/students', async (_req: Request, res: Response) => {
  try {
    if (db.isMock) {
      db.mockStore.students.clear();
      return res.json({ message: 'All student records cleared from mock store' });
    }
    await db.query('TRUNCATE TABLE students CASCADE');
    res.json({ message: 'All existing student records deleted successfully from database' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /students/:id
app.delete('/students/:id', async (req: Request, res: Response) => {
  try {
    const studentId = req.params.id.toUpperCase();

    if (db.isMock) {
      const deleted = db.mockStore.students.delete(studentId);
      if (!deleted) return res.status(404).json({ error: 'Student not found' });
      return res.json({ message: `Student ${studentId} deleted successfully` });
    }

    const result = await db.query('DELETE FROM students WHERE roll_number = $1 RETURNING roll_number', [studentId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json({ message: `Student ${studentId} deleted successfully` });
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

app.post('/students/:id/academics', async (req: Request, res: Response) => {
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

app.post('/students/:id/coding-profiles', async (req: Request, res: Response) => {
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

app.delete('/students/:id/coding-profiles/:platform', async (req: Request, res: Response) => {
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

app.post('/students/:id/tech-skills', async (req: Request, res: Response) => {
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

app.post('/students/:id/certifications', async (req: Request, res: Response) => {
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

app.post('/students/:id/soft-skills', async (req: Request, res: Response) => {
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

app.post('/students/:id/achievements', async (req: Request, res: Response) => {
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

app.put('/students/:id/placement-profile', async (req: Request, res: Response) => {
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
      'SELECT * FROM students WHERE faculty_mentor_id = $1 ORDER BY roll_number',
      [facultyId]
    );
    res.json(result.rows);
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
