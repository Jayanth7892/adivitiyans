import { Pool, QueryResult } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// ---------------------------------------------------------------------------
// AWS Secrets Manager retrieval (for Lambda deployment with RDS Proxy)
// ---------------------------------------------------------------------------
let cachedPassword: string | null = null;

async function getDbPassword(): Promise<string> {
  // If DB_PASSWORD is set directly, use it (local dev)
  if (process.env.DB_PASSWORD) {
    return process.env.DB_PASSWORD;
  }

  // If we already fetched the secret, reuse cached value
  if (cachedPassword) {
    return cachedPassword;
  }

  // Fetch from AWS Secrets Manager
  const secretArn = process.env.DB_SECRET_ARN;
  if (secretArn) {
    try {
      const { SecretsManagerClient, GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager');
      const client = new SecretsManagerClient({});
      const resp = await client.send(new GetSecretValueCommand({ SecretId: secretArn }));
      if (resp.SecretString) {
        const secret = JSON.parse(resp.SecretString);
        cachedPassword = secret.password;
        return cachedPassword!;
      }
    } catch (err: any) {
      console.error('[DB] Failed to retrieve secret from Secrets Manager:', err.message);
    }
  }

  // Fallback
  return process.env.DB_PASSWORD || 'postgres';
}

// ---------------------------------------------------------------------------
// Connection pool (lazy-initialized)
// ---------------------------------------------------------------------------
let pool: Pool | null = null;

async function getPool(): Promise<Pool> {
  if (pool) return pool;

  const password = await getDbPassword();

  pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password,
    database: process.env.DB_NAME || 'advitiyans',
    // For Lambda + RDS Proxy: keep local pool small; proxy handles pooling
    max: process.env.AWS_LAMBDA_FUNCTION_NAME ? 1 : 5,
    idleTimeoutMillis: 120000,
    connectionTimeoutMillis: 5000,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  pool.on('error', (err) => {
    console.error('[DB] Unexpected pool error:', err.message);
  });

  return pool;
}

// ---------------------------------------------------------------------------
// In-memory mock store (USE_MOCK=true fallback for local dev without DB)
// ---------------------------------------------------------------------------
const USE_MOCK = process.env.USE_MOCK === 'true';

const mockStudentsStore = new Map<string, any>();
const mockAcademicsStore = new Map<string, any[]>();
const mockCodingStore = new Map<string, any[]>();
const mockSkillsStore = new Map<string, any[]>();
const mockCertsStore = new Map<string, any[]>();
const mockSoftSkillsStore = new Map<string, any[]>();
const mockAchievementsStore = new Map<string, any[]>();
const mockPlacementStore = new Map<string, any>();

if (USE_MOCK) {
  console.log('[DB] Running in MOCK mode (USE_MOCK=true). No database connection.');

  const SAMPLE_STUDENTS = [
    {
      roll_number: '23091A3251', name: 'Jayanth Kumar', email: 'jayanth@rgmcet.edu.in',
      year: '', phone: '', address: '',
      native_place: '', department: '', batch: '', section: '',
      hostel_day_scholar: '', driving_license: false, passport: false,
      relocation_willingness: false, family_business: '',
      financial_background: '', faculty_mentor_id: 'FAC001',
      linkedin_url: '',
    },
  ];

  SAMPLE_STUDENTS.forEach((s) => {
    mockStudentsStore.set(s.roll_number, s);
    mockAcademicsStore.set(s.roll_number, []);
    mockCodingStore.set(s.roll_number, []);
    mockSkillsStore.set(s.roll_number, []);
    mockCertsStore.set(s.roll_number, []);
    mockSoftSkillsStore.set(s.roll_number, []);
    mockAchievementsStore.set(s.roll_number, []);
    mockPlacementStore.set(s.roll_number, {
      student_id: s.roll_number,
      placement_category: '',
      preferred_career: '',
      dream_company: [],
      employability_score: 0,
      skill_gap: [],
      suggested_certifications: [],
      higher_studies_interest: false,
      overall_potential: 0,
      research_potential: 0,
      need_from_department: '',
    });
  });
}

let schemaInitialized = false;

async function ensureSchema(p: Pool) {
  if (schemaInitialized) return;
  schemaInitialized = true;

  const ddlStatements = [
    `CREATE TABLE IF NOT EXISTS faculty (
      faculty_id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      department VARCHAR(50) NOT NULL,
      role VARCHAR(50) DEFAULT 'mentor',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE TABLE IF NOT EXISTS students (
      roll_number VARCHAR(10) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      year VARCHAR(20) NOT NULL,
      phone VARCHAR(20),
      address TEXT,
      native_place VARCHAR(100),
      department VARCHAR(50) NOT NULL DEFAULT 'CSE(Data Science)',
      batch VARCHAR(20) NOT NULL DEFAULT '2023-2027',
      section VARCHAR(10) DEFAULT 'A',
      hostel_day_scholar VARCHAR(20) DEFAULT 'Day Scholar',
      driving_license BOOLEAN DEFAULT FALSE,
      passport BOOLEAN DEFAULT FALSE,
      relocation_willingness BOOLEAN DEFAULT TRUE,
      family_business TEXT,
      financial_background VARCHAR(50),
      faculty_mentor_id VARCHAR(50) REFERENCES faculty(faculty_id) ON DELETE SET NULL,
      photo_url TEXT,
      resume_url TEXT,
      linkedin_url TEXT,
      linkedin_updated TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`,

    `UPDATE students SET department = 'CSE(Data Science)' WHERE department IS NULL OR department = '' OR department = 'CSE' OR department = 'Data Science' OR department = 'CSE (Data Science)';`,

    `CREATE TABLE IF NOT EXISTS academics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id VARCHAR(10) NOT NULL REFERENCES students(roll_number) ON DELETE CASCADE,
      semester INT NOT NULL,
      semester_gpa NUMERIC(4, 2),
      programming_grade VARCHAR(5),
      attendance_pct NUMERIC(5, 2),
      theory_grade VARCHAR(5),
      remarks TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(student_id, semester)
    );`,

    `CREATE TABLE IF NOT EXISTS coding_profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id VARCHAR(10) NOT NULL REFERENCES students(roll_number) ON DELETE CASCADE,
      platform VARCHAR(50) NOT NULL,
      handle VARCHAR(100) NOT NULL,
      streak INT DEFAULT 0,
      repositories_count INT DEFAULT 0,
      followers_count INT DEFAULT 0,
      stars_count INT DEFAULT 0,
      top_language VARCHAR(50) DEFAULT '',
      commits_count INT DEFAULT 0,
      prs_merged INT DEFAULT 0,
      score_rating NUMERIC(10, 2) DEFAULT 0.00,
      easy_count INT DEFAULT 0,
      medium_count INT DEFAULT 0,
      hard_count INT DEFAULT 0,
      contest_rating NUMERIC(10, 2) DEFAULT 0.00,
      last_synced TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(student_id, platform)
    );`,

    // Migrate existing deployed DBs — safe no-op if columns already exist
    `ALTER TABLE coding_profiles ADD COLUMN IF NOT EXISTS followers_count INT DEFAULT 0;`,
    `ALTER TABLE coding_profiles ADD COLUMN IF NOT EXISTS stars_count INT DEFAULT 0;`,
    `ALTER TABLE coding_profiles ADD COLUMN IF NOT EXISTS top_language VARCHAR(50) DEFAULT '';`,
    `ALTER TABLE coding_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;`,

    `CREATE TABLE IF NOT EXISTS tech_skills (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id VARCHAR(10) NOT NULL REFERENCES students(roll_number) ON DELETE CASCADE,
      skill_category VARCHAR(100) NOT NULL,
      specific_tool VARCHAR(100) NOT NULL,
      self_rating INT NOT NULL,
      verified BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(student_id, specific_tool)
    );`,

    `CREATE TABLE IF NOT EXISTS certifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id VARCHAR(10) NOT NULL REFERENCES students(roll_number) ON DELETE CASCADE,
      provider VARCHAR(100) NOT NULL,
      title VARCHAR(200) NOT NULL,
      date_completed DATE,
      certificate_file_url TEXT,
      suggested BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE TABLE IF NOT EXISTS soft_skills (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id VARCHAR(10) NOT NULL REFERENCES students(roll_number) ON DELETE CASCADE,
      skill VARCHAR(100) NOT NULL,
      rating INT NOT NULL,
      rated_by VARCHAR(20) DEFAULT 'self',
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(student_id, skill, rated_by)
    );`,

    `CREATE TABLE IF NOT EXISTS achievements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id VARCHAR(10) NOT NULL REFERENCES students(roll_number) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(200) NOT NULL,
      description TEXT NOT NULL,
      achievement_date DATE,
      organization VARCHAR(150),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE TABLE IF NOT EXISTS placement_profile (
      student_id VARCHAR(10) PRIMARY KEY REFERENCES students(roll_number) ON DELETE CASCADE,
      placement_category VARCHAR(100) DEFAULT 'Product Companies',
      preferred_career VARCHAR(100) DEFAULT 'AI & Full Stack Engineer',
      dream_company TEXT[] DEFAULT ARRAY['Google', 'Microsoft', 'Amazon'],
      employability_score NUMERIC(5, 2) DEFAULT 85.50,
      skill_gap JSONB DEFAULT '[]'::jsonb,
      suggested_certifications JSONB DEFAULT '[]'::jsonb,
      higher_studies_interest BOOLEAN DEFAULT FALSE,
      overall_potential NUMERIC(3, 1) DEFAULT 4.5,
      research_potential NUMERIC(3, 1) DEFAULT 4.0,
      need_from_department TEXT,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`,

    // Migrations: add columns that may be missing from earlier schema versions
    `ALTER TABLE students ADD COLUMN IF NOT EXISTS linkedin_updated TIMESTAMP WITH TIME ZONE;`,

    // Pre-seed fixed HOD account
    `INSERT INTO faculty (faculty_id, name, email, department, role)
     VALUES ('HOD_CSEDS', 'Dr. HOD (CSE & Data Science)', 'hodcseds@rgmcet.edu.in', 'Data Science', 'hod')
     ON CONFLICT (email) DO UPDATE SET role = 'hod', department = 'Data Science';`,

    // HOD credentials table — plain-text email+password managed by HOD and visible to admin
    `CREATE TABLE IF NOT EXISTS hod_credentials (
      id SERIAL PRIMARY KEY,
      email VARCHAR(100) NOT NULL,
      password TEXT NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`,

    // Seed HOD credentials with env defaults if no row exists yet
    `INSERT INTO hod_credentials (id, email, password)
     VALUES (1, 'hodcseds@rgmcet.edu.in', 'cseds@2026')
     ON CONFLICT (id) DO NOTHING;`,

    // Semester unlock settings — HOD/Admin controls which semesters students can fill
    `CREATE TABLE IF NOT EXISTS semester_unlock_settings (
      year_label VARCHAR(20) PRIMARY KEY,
      max_semester INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`,

    // Seed/correct semester unlock settings.
    // DO UPDATE enforces per-year maximum ceilings so legacy rows with invalid values (e.g. 8 for 1st Year)
    // get reset to the floor (0/2/4/6). Valid unlocked values (e.g. 1st Year at 1 or 2, 4th Year at 7 or 8)
    // are preserved.
    `INSERT INTO semester_unlock_settings (year_label, max_semester) VALUES
      ('1st Year', 0), ('2nd Year', 2), ('3rd Year', 4), ('4th Year', 6)
     ON CONFLICT (year_label) DO UPDATE
       SET max_semester = CASE
         WHEN semester_unlock_settings.year_label = '1st Year' AND semester_unlock_settings.max_semester > 2 THEN 0
         WHEN semester_unlock_settings.year_label = '2nd Year' AND semester_unlock_settings.max_semester > 4 THEN 2
         WHEN semester_unlock_settings.year_label = '3rd Year' AND semester_unlock_settings.max_semester > 6 THEN 4
         WHEN semester_unlock_settings.year_label = '4th Year' AND semester_unlock_settings.max_semester > 8 THEN 6
         ELSE semester_unlock_settings.max_semester
       END,
       updated_at = NOW();`,

    // Student passwords — admin-managed plain-text passwords (not Cognito)
    `CREATE TABLE IF NOT EXISTS student_passwords (
      roll_number VARCHAR(10) PRIMARY KEY REFERENCES students(roll_number) ON DELETE CASCADE,
      password TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`,

    // Super admin credentials — 3 fixed super admins, individually-changeable passwords
    `CREATE TABLE IF NOT EXISTS super_admin_credentials (
      email VARCHAR(100) PRIMARY KEY,
      password TEXT NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`,

    // Seed the 3 super admins — DO NOTHING on conflict so changed passwords survive redeploys
    `INSERT INTO super_admin_credentials (email, password) VALUES
      ('jayakrushna1622@gmail.com', 'jdj275152'),
      ('dineshkumarpathipati@gmail.com', 'jdj275152'),
      ('jayanthkumarnaidu777@gmail.com', 'jdj275152')
     ON CONFLICT (email) DO NOTHING;`,

    // Regular admin accounts — created/managed by super admins
    `CREATE TABLE IF NOT EXISTS admin_accounts (
      email VARCHAR(100) PRIMARY KEY,
      name  VARCHAR(100) NOT NULL DEFAULT 'Admin',
      password TEXT NOT NULL,
      created_by VARCHAR(100),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`,

    `INSERT INTO admin_accounts (email, name, password, created_by) VALUES
      ('admin@rgmcet.edu.in', 'College Administrator', 'admin@2026', 'System')
     ON CONFLICT (email) DO NOTHING;`,

    // Single-session enforcement table — one active session per email
    // Must exist before any delete route tries to clean up user_sessions
    `CREATE TABLE IF NOT EXISTS user_sessions (
      email VARCHAR(100) PRIMARY KEY,
      session_token VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
    );`,
  ];

  try {
    const client = await p.connect();
    try {
      for (const stmt of ddlStatements) {
        await client.query(stmt).catch((err) => {
          console.warn('[DB] DDL statement warning:', err.message);
        });
      }
      console.log('[DB] Automatic database schema setup verified.');
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.warn('[DB] Schema connection warning:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Exported db object
// ---------------------------------------------------------------------------
export const db = {
  /**
   * Execute a parameterized SQL query against PostgreSQL (via RDS Proxy in production).
   * In mock mode, returns empty results.
   */
  async query(text: string, params: any[] = []): Promise<QueryResult> {
    if (USE_MOCK) {
      // Return empty result for mock mode — routes use mockStore directly
      return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] } as any;
    }
    const p = await getPool();
    await ensureSchema(p);
    try {
      return await p.query(text, params);
    } catch (err: any) {
      const msg = String(err.message || err);
      if (msg.includes('does not exist') || err.code === '42P01') {
        console.warn('[DB] Missing table error caught. Retrying schema initialization...');
        schemaInitialized = false;
        await ensureSchema(p);
        return await p.query(text, params);
      }
      throw err;
    }
  },

  /**
   * Health check — verifies database connectivity.
   */
  async healthCheck(): Promise<{ connected: boolean; via: string; host: string }> {
    if (USE_MOCK) {
      return { connected: true, via: 'mock', host: 'in-memory' };
    }
    try {
      const p = await getPool();
      const res = await p.query('SELECT 1 AS ok');
      const host = process.env.DB_HOST || 'localhost';
      const isProxy = host.includes('.proxy-') || host.includes('rds-proxy');
      return { connected: res.rows[0]?.ok === 1, via: isProxy ? 'rds-proxy' : 'direct', host };
    } catch (err: any) {
      return { connected: false, via: 'error', host: err.message };
    }
  },

  /**
   * Mock store — only populated when USE_MOCK=true.
   */
  mockStore: {
    students: mockStudentsStore,
    academics: mockAcademicsStore,
    codingProfiles: mockCodingStore,
    techSkills: mockSkillsStore,
    certifications: mockCertsStore,
    softSkills: mockSoftSkillsStore,
    achievements: mockAchievementsStore,
    placement: mockPlacementStore,
  },

  /** Whether mock mode is active */
  isMock: USE_MOCK,
};
