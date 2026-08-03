import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'advitiyans',
  max: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// In-memory store for local testing without active PostgreSQL
const mockStudentsStore = new Map<string, any>();
const mockAcademicsStore = new Map<string, any[]>();
const mockCodingStore = new Map<string, any[]>();
const mockSkillsStore = new Map<string, any[]>();
const mockCertsStore = new Map<string, any[]>();
const mockSoftSkillsStore = new Map<string, any[]>();
const mockAchievementsStore = new Map<string, any[]>();
const mockPlacementStore = new Map<string, any>();

// Seed students
const SAMPLE_STUDENTS = [
  {
    roll_number: '23091A3251',
    name: 'Jayanth Kumar',
    email: 'jayanth@rgmcet.edu.in',
    year: '3rd Year',
    phone: '9876543210',
    address: 'Nandyal, Andhra Pradesh',
    native_place: 'Nandyal',
    department: 'CSE',
    batch: '2023-2027',
    section: 'A',
    hostel_day_scholar: 'Day Scholar',
    driving_license: true,
    passport: true,
    relocation_willingness: true,
    family_business: 'Agriculture',
    financial_background: 'Middle Class',
    faculty_mentor_id: 'FAC001',
    linkedin_url: 'https://linkedin.com/in/jayanth-kumar',
  },
  {
    roll_number: '23091A3252',
    name: 'Ananya Sharma',
    email: 'ananya@rgmcet.edu.in',
    year: '3rd Year',
    phone: '9876543211',
    address: 'Kurnool, Andhra Pradesh',
    native_place: 'Kurnool',
    department: 'CSE',
    batch: '2023-2027',
    section: 'B',
    hostel_day_scholar: 'Hostel',
    driving_license: false,
    passport: true,
    relocation_willingness: true,
    family_business: 'Retail Business',
    financial_background: 'Upper Middle Class',
    faculty_mentor_id: 'FAC001',
    linkedin_url: 'https://linkedin.com/in/ananya-sharma',
  },
  {
    roll_number: '23091A3253',
    name: 'Vikram Reddy',
    email: 'vikram@rgmcet.edu.in',
    year: '4th Year',
    phone: '9876543212',
    address: 'Tirupati, Andhra Pradesh',
    native_place: 'Tirupati',
    department: 'ECE',
    batch: '2022-2026',
    section: 'A',
    hostel_day_scholar: 'Day Scholar',
    driving_license: true,
    passport: false,
    relocation_willingness: true,
    family_business: 'Engineering Services',
    financial_background: 'Middle Class',
    faculty_mentor_id: 'FAC002',
    linkedin_url: 'https://linkedin.com/in/vikram-reddy',
  },
  {
    roll_number: '23091A3254',
    name: 'Sneha Patel',
    email: 'sneha@rgmcet.edu.in',
    year: '2nd Year',
    phone: '9876543213',
    address: 'Vijayawada, Andhra Pradesh',
    native_place: 'Vijayawada',
    department: 'CSE',
    batch: '2024-2028',
    section: 'C',
    hostel_day_scholar: 'Hostel',
    driving_license: true,
    passport: true,
    relocation_willingness: true,
    family_business: 'Pharma Supply',
    financial_background: 'Upper Middle Class',
    faculty_mentor_id: 'FAC001',
    linkedin_url: 'https://linkedin.com/in/sneha-patel',
  },
  {
    roll_number: '23091A3255',
    name: 'Rahul Verma',
    email: 'rahul@rgmcet.edu.in',
    year: '4th Year',
    phone: '9876543214',
    address: 'Guntur, Andhra Pradesh',
    native_place: 'Guntur',
    department: 'EEE',
    batch: '2022-2026',
    section: 'B',
    hostel_day_scholar: 'Day Scholar',
    driving_license: false,
    passport: false,
    relocation_willingness: false,
    family_business: 'Textiles',
    financial_background: 'Middle Class',
    faculty_mentor_id: 'FAC002',
    linkedin_url: 'https://linkedin.com/in/rahul-verma',
  },
];

// Initialize all student records — NO pre-filled demo coding profiles
SAMPLE_STUDENTS.forEach((s) => {
  mockStudentsStore.set(s.roll_number, s);

  mockAcademicsStore.set(s.roll_number, [
    { semester: 1, semester_gpa: 8.8, programming_grade: 'A+', attendance_pct: 94.5, theory_grade: 'A', remarks: 'Excellent in C' },
    { semester: 2, semester_gpa: 9.1, programming_grade: 'O', attendance_pct: 96.0, theory_grade: 'A+', remarks: 'Outstanding in DS' },
    { semester: 3, semester_gpa: 9.3, programming_grade: 'O', attendance_pct: 95.0, theory_grade: 'O', remarks: 'Top rank Java' },
    { semester: 4, semester_gpa: 9.45, programming_grade: 'O', attendance_pct: 98.0, theory_grade: 'O', remarks: 'Top score DBMS' },
  ]);

  // Clean empty array: NO demo coding handles
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

export const db = {
  async query(text: string, params: any[] = []) {
    try {
      const res = await pool.query(text, params);
      return res;
    } catch (err) {
      return simulateMockQuery(text, params);
    }
  },
  mockStore: {
    students: mockStudentsStore,
    academics: mockAcademicsStore,
    codingProfiles: mockCodingStore,
    techSkills: mockSkillsStore,
    certifications: mockCertsStore,
    softSkills: mockSoftSkillsStore,
    achievements: mockAchievementsStore,
    placement: mockPlacementStore,
  }
};

function simulateMockQuery(text: string, params: any[]): any {
  const normalizedText = text.toLowerCase().trim();

  // Handle INSERT / UPDATE for coding_profiles in mock store
  if (normalizedText.startsWith('insert into coding_profiles') || normalizedText.startsWith('update coding_profiles')) {
    const regNo = params[0] || '23091A3251';
    const platform = params[1];
    const handle = params[2];
    const existing = mockCodingStore.get(regNo) || [];
    const updated = existing.filter((p) => p.platform !== platform);
    updated.push({
      id: String(Date.now()),
      platform,
      handle,
      streak: 0,
      repositories_count: 0,
      commits_count: 0,
      prs_merged: 0,
      score_rating: 0,
    });
    mockCodingStore.set(regNo, updated);
    return { rows: updated };
  }

  // Availability check
  if (normalizedText.includes('select 1 from students where email')) {
    const email = params[0]?.toLowerCase();
    let exists = false;
    for (const student of mockStudentsStore.values()) {
      if (student.email.toLowerCase() === email) { exists = true; break; }
    }
    return { rows: exists ? [{ exists: true }] : [] };
  }

  if (normalizedText.includes('select 1 from students where roll_number')) {
    const regNo = params[0]?.toUpperCase();
    const exists = mockStudentsStore.has(regNo);
    return { rows: exists ? [{ exists: true }] : [] };
  }

  // Get student by ID
  if (normalizedText.includes('from students where roll_number')) {
    const regNo = params[0]?.toUpperCase();
    const student = mockStudentsStore.get(regNo) || mockStudentsStore.get('23091A3251');
    return { rows: student ? [student] : [] };
  }

  // Sub-resources
  if (normalizedText.includes('from academics')) {
    const regNo = params[0] || '23091A3251';
    return { rows: mockAcademicsStore.get(regNo) || [] };
  }
  if (normalizedText.includes('from coding_profiles')) {
    const regNo = params[0] || '23091A3251';
    return { rows: mockCodingStore.get(regNo) || [] };
  }
  if (normalizedText.includes('from tech_skills')) {
    const regNo = params[0] || '23091A3251';
    return { rows: mockSkillsStore.get(regNo) || [] };
  }
  if (normalizedText.includes('from certifications')) {
    const regNo = params[0] || '23091A3251';
    return { rows: mockCertsStore.get(regNo) || [] };
  }
  if (normalizedText.includes('from soft_skills')) {
    const regNo = params[0] || '23091A3251';
    return { rows: mockSoftSkillsStore.get(regNo) || [] };
  }
  if (normalizedText.includes('from achievements')) {
    const regNo = params[0] || '23091A3251';
    return { rows: mockAchievementsStore.get(regNo) || [] };
  }
  if (normalizedText.includes('from placement_profile')) {
    const regNo = params[0] || '23091A3251';
    return { rows: [mockPlacementStore.get(regNo) || {}] };
  }

  return { rows: [] };
}
