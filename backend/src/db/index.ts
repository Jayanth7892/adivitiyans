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
      year: '3rd Year', phone: '', address: '',
      native_place: '', department: 'CSE', batch: '2023-2027', section: 'A',
      hostel_day_scholar: 'Day Scholar', driving_license: false, passport: false,
      relocation_willingness: true, family_business: '',
      financial_background: '', faculty_mentor_id: 'FAC001',
      linkedin_url: '',
    },
    {
      roll_number: '23091A3252', name: 'dasamneni', email: 'dasamneni@rgmcet.edu.in',
      year: '3rd Year', phone: '', address: '',
      native_place: '', department: 'CSE', batch: '2023-2027', section: 'B',
      hostel_day_scholar: 'Day Scholar', driving_license: false, passport: false,
      relocation_willingness: true, family_business: '',
      financial_background: '', faculty_mentor_id: 'FAC001',
      linkedin_url: '',
    },
    {
      roll_number: '23091A3253', name: 'Pathipati Dinesh Kumar', email: 'dinesh@rgmcet.edu.in',
      year: '4th Year', phone: '', address: '',
      native_place: '', department: 'CSE', batch: '2022-2026', section: 'A',
      hostel_day_scholar: 'Day Scholar', driving_license: false, passport: false,
      relocation_willingness: true, family_business: '',
      financial_background: '', faculty_mentor_id: 'FAC002',
      linkedin_url: '',
    },
    {
      roll_number: '23091A3207', name: 'amar', email: 'amar@rgmcet.edu.in',
      year: '4th Year', phone: '', address: '',
      native_place: '', department: 'CSE', batch: '2022-2026', section: 'A',
      hostel_day_scholar: 'Day Scholar', driving_license: false, passport: false,
      relocation_willingness: true, family_business: '',
      financial_background: '', faculty_mentor_id: 'FAC001',
      linkedin_url: '',
    },
    {
      roll_number: '23091A3278', name: 'Bellamkonda Pranav', email: 'pranav@rgmcet.edu.in',
      year: '4th Year', phone: '', address: '',
      native_place: '', department: 'CSE', batch: '2022-2026', section: 'A',
      hostel_day_scholar: 'Day Scholar', driving_license: false, passport: false,
      relocation_willingness: true, family_business: '',
      financial_background: '', faculty_mentor_id: 'FAC002',
      linkedin_url: '',
    },
  ];

  SAMPLE_STUDENTS.forEach((s) => {
    mockStudentsStore.set(s.roll_number, s);
    mockAcademicsStore.set(s.roll_number, [
      { semester: 1, semester_gpa: 8.8, programming_grade: 'A+', attendance_pct: 94.5, theory_grade: 'A', remarks: 'Excellent in C' },
      { semester: 2, semester_gpa: 9.1, programming_grade: 'O', attendance_pct: 96.0, theory_grade: 'A+', remarks: 'Outstanding in DS' },
      { semester: 3, semester_gpa: 9.3, programming_grade: 'O', attendance_pct: 95.0, theory_grade: 'O', remarks: 'Top rank Java' },
      { semester: 4, semester_gpa: 9.45, programming_grade: 'O', attendance_pct: 98.0, theory_grade: 'O', remarks: 'Top score DBMS' },
    ]);
    mockCodingStore.set(s.roll_number, []);
    mockSkillsStore.set(s.roll_number, [
      { id: '1', skill_category: 'AI/Agentic', specific_tool: 'Claude Code & CrewAI', self_rating: 5, verified: true },
      { id: '2', skill_category: 'Cloud', specific_tool: 'AWS Lambda & S3', self_rating: 4, verified: true },
      { id: '3', skill_category: 'Full Stack', specific_tool: 'React & TypeScript', self_rating: 5, verified: true },
    ]);
    mockCertsStore.set(s.roll_number, [
      { id: '1', provider: 'AWS', title: 'AWS Certified Solutions Architect Associate', date_completed: '2024-03-15', certificate_file_url: null, suggested: false },
      { id: '2', provider: 'Coursera', title: 'Deep Learning Specialization by Andrew Ng', date_completed: '2024-01-20', certificate_file_url: null, suggested: false },
      { id: '3', provider: 'NPTEL', title: 'Programming, Data Structures And Algorithms Using Python', date_completed: null, certificate_file_url: null, suggested: true },
    ]);
    mockSoftSkillsStore.set(s.roll_number, [
      { skill: 'Leadership', rating: 5, rated_by: 'self' },
      { skill: 'Communication', rating: 4, rated_by: 'self' },
      { skill: 'Teamwork', rating: 5, rated_by: 'self' },
      { skill: 'Time Management', rating: 4, rated_by: 'self' },
      { skill: 'Public Speaking', rating: 4, rated_by: 'self' },
      { skill: 'Learning Ability', rating: 5, rated_by: 'self' },
      { skill: 'Professionalism', rating: 5, rated_by: 'self' },
    ]);
    mockAchievementsStore.set(s.roll_number, [
      { id: '1', type: 'Hackathon', title: '1st Place in Smart India Hackathon 2024', description: 'Built AI placement system', achievement_date: '2024-02-18', organization: 'AICTE' },
      { id: '2', type: 'Capstone Project', title: 'Advitiyans Student 360 Platform', description: 'Architected serverless cloud platform', achievement_date: '2024-04-10', organization: 'RGMCET' },
    ]);
    mockPlacementStore.set(s.roll_number, {
      student_id: s.roll_number,
      placement_category: 'Product Companies',
      preferred_career: 'AI & Full Stack Engineer',
      dream_company: ['Google', 'Microsoft', 'Amazon', 'Atlassian'],
      employability_score: 92.4,
      skill_gap: ['Deepen System Design experience', 'Kubernetes administration'],
      suggested_certifications: ['AWS Certified Developer Associate', 'CKAD'],
      higher_studies_interest: false,
      overall_potential: 4.9,
      research_potential: 4.5,
      need_from_department: 'Advanced mock interview sessions with industry alumni.',
    });
  });
}

let schemaInitialized = false;

async function ensureSchema(p: Pool) {
  if (schemaInitialized) return;
  schemaInitialized = true;
  try {
    const client = await p.connect();
    try {
      await client.query(`
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

        CREATE TABLE IF NOT EXISTS faculty (
          faculty_id VARCHAR(50) PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          department VARCHAR(50) NOT NULL,
          role VARCHAR(50) DEFAULT 'mentor',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS students (
          roll_number VARCHAR(10) PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          year VARCHAR(20) NOT NULL,
          phone VARCHAR(20),
          address TEXT,
          native_place VARCHAR(100),
          department VARCHAR(50) NOT NULL DEFAULT 'CSE',
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
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS academics (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
        );

        CREATE TABLE IF NOT EXISTS coding_profiles (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          student_id VARCHAR(10) NOT NULL REFERENCES students(roll_number) ON DELETE CASCADE,
          platform VARCHAR(50) NOT NULL,
          handle VARCHAR(100) NOT NULL,
          streak INT DEFAULT 0,
          repositories_count INT DEFAULT 0,
          commits_count INT DEFAULT 0,
          prs_merged INT DEFAULT 0,
          score_rating NUMERIC(10, 2) DEFAULT 0.00,
          easy_count INT DEFAULT 0,
          medium_count INT DEFAULT 0,
          hard_count INT DEFAULT 0,
          contest_rating NUMERIC(10, 2) DEFAULT 0.00,
          last_synced TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(student_id, platform)
        );

        CREATE TABLE IF NOT EXISTS tech_skills (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          student_id VARCHAR(10) NOT NULL REFERENCES students(roll_number) ON DELETE CASCADE,
          skill_category VARCHAR(100) NOT NULL,
          specific_tool VARCHAR(100) NOT NULL,
          self_rating INT NOT NULL,
          verified BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(student_id, specific_tool)
        );

        CREATE TABLE IF NOT EXISTS certifications (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          student_id VARCHAR(10) NOT NULL REFERENCES students(roll_number) ON DELETE CASCADE,
          provider VARCHAR(100) NOT NULL,
          title VARCHAR(200) NOT NULL,
          date_completed DATE,
          certificate_file_url TEXT,
          suggested BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS soft_skills (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          student_id VARCHAR(10) NOT NULL REFERENCES students(roll_number) ON DELETE CASCADE,
          skill VARCHAR(100) NOT NULL,
          rating INT NOT NULL,
          rated_by VARCHAR(20) DEFAULT 'self',
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(student_id, skill, rated_by)
        );

        CREATE TABLE IF NOT EXISTS achievements (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          student_id VARCHAR(10) NOT NULL REFERENCES students(roll_number) ON DELETE CASCADE,
          type VARCHAR(50) NOT NULL,
          title VARCHAR(200) NOT NULL,
          description TEXT NOT NULL,
          achievement_date DATE,
          organization VARCHAR(150),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS placement_profile (
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
        );
      `);
      console.log('[DB] Automatic database schema check/creation complete.');
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.warn('[DB] Automatic schema initialization warning:', err.message);
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
