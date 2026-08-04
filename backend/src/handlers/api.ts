import express, { Request, Response } from 'express';
import cors from 'cors';
import serverless from 'serverless-http';
import { db } from '../db';
import { calculateEmployabilityScore } from '../services/employability';
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

// Health Check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'advitiyans-api' });
});

// Check availability (Live inline checks for Sign-Up form)
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

      const mockStudents = db.mockStore.students;
      let taken = false;
      for (const s of mockStudents.values()) {
        if (s.email.toLowerCase() === emailStr) { taken = true; break; }
      }

      if (!taken) {
        const queryRes = await db.query('SELECT 1 FROM students WHERE LOWER(email) = $1', [emailStr]);
        if (queryRes.rows && queryRes.rows.length > 0) taken = true;
      }

      return res.json({ available: !taken, message: taken ? 'Email is already registered' : 'Email available' });
    }

    if (type === 'regNo') {
      const regStr = String(value).trim().toUpperCase();
      if (!REGISTRATION_NUMBER_REGEX.test(regStr)) {
        return res.json({ available: false, message: "Must match 10-char format (e.g. 23091A3251). Positions 7-8 must be '32'" });
      }

      let taken = db.mockStore.students.has(regStr);
      if (!taken) {
        const queryRes = await db.query('SELECT 1 FROM students WHERE UPPER(roll_number) = $1', [regStr]);
        if (queryRes.rows && queryRes.rows.length > 0) taken = true;
      }

      return res.json({ available: !taken, message: taken ? 'Registration number is already registered' : 'Registration number available' });
    }

    return res.status(400).json({ error: 'Invalid check type' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin / Faculty / HOD: GET /students (List/Search/Filter by Year, Section, Standing)
app.get('/students', async (req: Request, res: Response) => {
  try {
    const { department, batch, section, year, standing, mentor_id, search } = req.query;
    let students = Array.from(db.mockStore.students.values());

    if (department && String(department) !== 'All') {
      students = students.filter((s) => s.department === department);
    }
    if (batch && String(batch) !== 'All') {
      students = students.filter((s) => s.batch === batch);
    }
    if (year && String(year) !== 'All') {
      students = students.filter((s) => s.year === year);
    }
    if (section && String(section) !== 'All') {
      const secFormatted = String(section).replace('Section ', '').replace('Sec ', '');
      students = students.filter((s) => s.section === secFormatted || s.section === `Sec ${secFormatted}`);
    }
    if (standing && String(standing) !== 'All') {
      students = students.filter((s) => (s as any).standing === standing);
    }
    if (mentor_id) {
      students = students.filter((s) => s.faculty_mentor_id === mentor_id);
    }
    if (search) {
      const q = String(search).toLowerCase();
      students = students.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        s.roll_number.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
      );
    }

    res.json(students);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: POST /students (Create Student Record)
app.post('/students', async (req: Request, res: Response) => {
  try {
    const validatedData = studentProfileSchema.parse(req.body);
    const regNo = validatedData.roll_number.toUpperCase();

    if (db.mockStore.students.has(regNo)) {
      return res.status(400).json({ error: 'Student with this registration number already exists' });
    }

    const newStudent = {
      ...validatedData,
      roll_number: regNo,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    db.mockStore.students.set(regNo, newStudent);
    res.status(201).json({ message: 'Student created successfully', student: newStudent });
  } catch (err: any) {
    res.status(400).json({ error: err.message || err });
  }
});

// Helper: Ensure fallback student profile is dynamically initialized if missing
function getOrInitializeStudent(studentId: string) {
  const regNo = studentId.toUpperCase();
  let student = db.mockStore.students.get(regNo);
  if (!student) {
    student = {
      roll_number: regNo,
      name: `Student (${regNo})`,
      email: `${regNo.toLowerCase()}@rgmcet.edu.in`,
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
      family_business: 'Software Engineering',
      financial_background: 'Middle Class',
      faculty_mentor_id: 'FAC001',
      linkedin_url: `https://linkedin.com/in/${regNo.toLowerCase()}`,
    };
    db.mockStore.students.set(regNo, student);
  }
  return student;
}

// Student / Faculty / Admin / HOD: GET /students/{id}
app.get('/students/:id', async (req: Request, res: Response) => {
  try {
    const studentId = req.params.id.toUpperCase();
    let student = db.mockStore.students.get(studentId);
    if (!student) {
      const queryRes = await db.query('SELECT * FROM students WHERE UPPER(roll_number) = $1', [studentId]);
      if (queryRes.rows.length > 0) student = queryRes.rows[0];
    }
    if (!student) {
      student = getOrInitializeStudent(studentId);
    }
    res.json(student);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Student / Admin: PUT /students/{id}
app.put('/students/:id', async (req: Request, res: Response) => {
  try {
    const studentId = req.params.id.toUpperCase();
    const validatedData = studentProfileSchema.parse(req.body);
    
    const existing = db.mockStore.students.get(studentId) || getOrInitializeStudent(studentId);
    const updated = { ...existing, ...validatedData, roll_number: studentId, updated_at: new Date().toISOString() };
    db.mockStore.students.set(studentId, updated);

    res.json({ message: 'Profile updated successfully', student: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message || err });
  }
});

// Admin: DELETE /students/{id}
app.delete('/students/:id', async (req: Request, res: Response) => {
  try {
    const studentId = req.params.id.toUpperCase();
    const deleted = db.mockStore.students.delete(studentId);
    if (!deleted) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json({ message: `Student ${studentId} deleted successfully` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Sub-resources: Academics
app.get('/students/:id/academics', async (req: Request, res: Response) => {
  const studentId = req.params.id.toUpperCase();
  const academics = db.mockStore.academics.get(studentId) || db.mockStore.academics.get('23091A3251') || [
    { semester: 1, semester_gpa: 8.80, attendance_pct: 95.0, programming_grade: 'O', theory_grade: 'A+' },
    { semester: 2, semester_gpa: 8.95, attendance_pct: 96.0, programming_grade: 'O', theory_grade: 'A+' },
    { semester: 3, semester_gpa: 9.15, attendance_pct: 94.0, programming_grade: 'O', theory_grade: 'A+' },
    { semester: 4, semester_gpa: 9.30, attendance_pct: 95.0, programming_grade: 'O', theory_grade: 'A+' },
    { semester: 5, semester_gpa: 9.45, attendance_pct: 96.0, programming_grade: 'O', theory_grade: 'A+' },
  ];
  res.json(academics);
});

app.post('/students/:id/academics', async (req: Request, res: Response) => {
  try {
    const studentId = req.params.id.toUpperCase();
    const validated = academicSchema.parse(req.body);
    const existing = db.mockStore.academics.get(studentId) || [];
    const updated = existing.filter(a => a.semester !== validated.semester);
    updated.push(validated);
    updated.sort((a, b) => a.semester - b.semester);
    db.mockStore.academics.set(studentId, updated);
    res.json({ message: 'Academic record saved', academics: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Sub-resources: Coding Profiles
app.get('/students/:id/coding-profiles', async (req: Request, res: Response) => {
  const studentId = req.params.id.toUpperCase();
  const profiles = db.mockStore.codingProfiles.get(studentId) || db.mockStore.codingProfiles.get('23091A3251') || [
    { platform: 'LeetCode', handle: 'jayanth_k', streak: 45, score_rating: 1845 },
    { platform: 'GitHub', handle: 'jayanth-kumar', repositories_count: 42, commits_count: 310, prs_merged: 18 },
  ];
  res.json(profiles);
});

app.post('/students/:id/coding-profiles', async (req: Request, res: Response) => {
  try {
    const studentId = req.params.id.toUpperCase();
    const validated = codingProfileSchema.parse(req.body);
    const existing = db.mockStore.codingProfiles.get(studentId) || [];
    const updated = existing.filter(p => p.platform !== validated.platform);
    updated.push({ ...validated, id: String(Date.now()) });
    db.mockStore.codingProfiles.set(studentId, updated);
    res.json({ message: 'Coding profile updated', profiles: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Sub-resources: Tech Skills
app.get('/students/:id/tech-skills', async (req: Request, res: Response) => {
  const studentId = req.params.id.toUpperCase();
  const skills = db.mockStore.techSkills.get(studentId) || db.mockStore.techSkills.get('23091A3251') || [
    { skill_category: 'AI/Agentic', specific_tool: 'Claude Code', self_rating: 5, verified: true },
    { skill_category: 'AI/Agentic', specific_tool: 'Cursor', self_rating: 5, verified: true },
    { skill_category: 'Cloud', specific_tool: 'AWS Lambda & S3', self_rating: 4, verified: true },
  ];
  res.json(skills);
});

app.post('/students/:id/tech-skills', async (req: Request, res: Response) => {
  try {
    const studentId = req.params.id.toUpperCase();
    const validated = techSkillSchema.parse(req.body);
    const existing = db.mockStore.techSkills.get(studentId) || [];
    const updated = existing.filter(s => s.specific_tool !== validated.specific_tool);
    updated.push({ ...validated, id: String(Date.now()) });
    db.mockStore.techSkills.set(studentId, updated);
    res.json({ message: 'Tech skill added', skills: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Sub-resources: Certifications
app.get('/students/:id/certifications', async (req: Request, res: Response) => {
  const studentId = req.params.id.toUpperCase();
  const certs = db.mockStore.certifications.get(studentId) || db.mockStore.certifications.get('23091A3251') || [
    { provider: 'AWS', title: 'AWS Certified Solutions Architect', date_completed: '2024-03-15', suggested: false },
  ];
  res.json(certs);
});

app.post('/students/:id/certifications', async (req: Request, res: Response) => {
  try {
    const studentId = req.params.id.toUpperCase();
    const validated = certificationSchema.parse(req.body);
    const existing = db.mockStore.certifications.get(studentId) || [];
    existing.push({ ...validated, id: String(Date.now()) });
    db.mockStore.certifications.set(studentId, existing);
    res.json({ message: 'Certification added', certifications: existing });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Sub-resources: Soft Skills
app.get('/students/:id/soft-skills', async (req: Request, res: Response) => {
  const studentId = req.params.id.toUpperCase();
  const skills = db.mockStore.softSkills.get(studentId) || db.mockStore.softSkills.get('23091A3251') || [];
  res.json(skills);
});

app.post('/students/:id/soft-skills', async (req: Request, res: Response) => {
  try {
    const studentId = req.params.id.toUpperCase();
    const validated = softSkillSchema.parse(req.body);
    const existing = db.mockStore.softSkills.get(studentId) || [];
    const updated = existing.filter(s => !(s.skill === validated.skill && s.rated_by === validated.rated_by));
    updated.push(validated);
    db.mockStore.softSkills.set(studentId, updated);
    res.json({ message: 'Soft skill rating saved', softSkills: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Sub-resources: Achievements
app.get('/students/:id/achievements', async (req: Request, res: Response) => {
  const studentId = req.params.id.toUpperCase();
  const achievements = db.mockStore.achievements.get(studentId) || db.mockStore.achievements.get('23091A3251') || [];
  res.json(achievements);
});

app.post('/students/:id/achievements', async (req: Request, res: Response) => {
  try {
    const studentId = req.params.id.toUpperCase();
    const validated = achievementSchema.parse(req.body);
    const existing = db.mockStore.achievements.get(studentId) || [];
    existing.unshift({ ...validated, id: String(Date.now()) });
    db.mockStore.achievements.set(studentId, existing);
    res.json({ message: 'Achievement added', achievements: existing });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Sub-resources: Placement Profile
app.get('/students/:id/placement-profile', async (req: Request, res: Response) => {
  const studentId = req.params.id.toUpperCase();
  const placement = db.mockStore.placement.get(studentId) || db.mockStore.placement.get('23091A3251') || {
    preferred_career: 'AI & Full Stack Engineer',
    dream_company: ['Generative AI', 'Cloud Architecture', 'Distributed Systems'],
    higher_studies_interest: false,
  };
  res.json(placement);
});

app.put('/students/:id/placement-profile', async (req: Request, res: Response) => {
  try {
    const studentId = req.params.id.toUpperCase();
    const validated = placementProfileSchema.parse(req.body);
    const existing = db.mockStore.placement.get(studentId) || {};
    const updated = { ...existing, ...validated, student_id: studentId, updated_at: new Date().toISOString() };
    db.mockStore.placement.set(studentId, updated);
    res.json({ message: 'Placement preferences saved', placement: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Employability Score Calculator Endpoint
app.get('/students/:id/employability-score', async (req: Request, res: Response) => {
  try {
    const studentId = req.params.id.toUpperCase();
    const academics = db.mockStore.academics.get(studentId) || db.mockStore.academics.get('23091A3251') || [];
    const codingProfiles = db.mockStore.codingProfiles.get(studentId) || db.mockStore.codingProfiles.get('23091A3251') || [];
    const techSkills = db.mockStore.techSkills.get(studentId) || db.mockStore.techSkills.get('23091A3251') || [];
    const certifications = db.mockStore.certifications.get(studentId) || db.mockStore.certifications.get('23091A3251') || [];
    const softSkills = db.mockStore.softSkills.get(studentId) || db.mockStore.softSkills.get('23091A3251') || [];
    const achievements = db.mockStore.achievements.get(studentId) || db.mockStore.achievements.get('23091A3251') || [];

    const scoreData = calculateEmployabilityScore({
      academics,
      codingProfiles,
      techSkills,
      certifications,
      softSkills,
      achievements,
    });

    res.json(scoreData);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Upload S3 Pre-signed URL Generator
app.get('/students/:id/upload-url', async (req: Request, res: Response) => {
  const { fileName, uploadType } = req.query;
  const mockS3UploadUrl = `https://advitiyans-uploads.s3.amazonaws.com/students/${req.params.id}/${uploadType || 'docs'}/${Date.now()}_${fileName || 'file.pdf'}`;
  res.json({
    uploadUrl: mockS3UploadUrl,
    fileKey: `students/${req.params.id}/${uploadType || 'docs'}/${Date.now()}_${fileName || 'file.pdf'}`,
    expiresInSeconds: 300,
  });
});

// Faculty: GET /faculty/:id/mentees
app.get('/faculty/:id/mentees', async (req: Request, res: Response) => {
  try {
    const facultyId = req.params.id.toUpperCase();
    const students = Array.from(db.mockStore.students.values()).filter(
      (s) => s.faculty_mentor_id === facultyId || facultyId === 'FAC001'
    );
    res.json(students);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Reports: HOD Interactive Analytics Summary
app.get('/reports/hod-analytics', async (_req: Request, res: Response) => {
  const students = Array.from(db.mockStore.students.values()).filter((s) => s.department === 'CSE');

  res.json({
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
    topRankers: students.slice(0, 5),
  });
});

// Reports: GET /reports/department/:dept
app.get('/reports/department/:dept', async (req: Request, res: Response) => {
  const dept = req.params.dept.toUpperCase();
  const { year, section } = req.query;
  let students = Array.from(db.mockStore.students.values()).filter((s) => s.department === dept);

  if (year && String(year) !== 'All') {
    students = students.filter((s) => s.year === year);
  }
  if (section && String(section) !== 'All') {
    const secFormatted = String(section).replace('Section ', '').replace('Sec ', '');
    students = students.filter((s) => s.section === secFormatted || s.section === `Sec ${secFormatted}`);
  }

  res.json({
    department: dept,
    totalStudents: students.length || 5,
    avgGpa: 9.15,
    avgEmployabilityScore: 88.5,
    eligibleForPlacementCount: students.length || 5,
    topSkills: ['Claude Code & CrewAI', 'React & TypeScript', 'AWS Lambda & S3'],
  });
});

// Reports: GET /reports/placement-summary (CSV export data)
app.get('/reports/placement-summary', async (_req: Request, res: Response) => {
  const students = Array.from(db.mockStore.students.values());
  res.json({
    summary: {
      totalRegistered: students.length,
      placementEligible: students.length,
      avgEmployabilityScore: 89.2,
      topDreamCompanies: ['Google', 'Microsoft', 'Amazon', 'Atlassian', 'AWS'],
    },
    students,
  });
});

export const handler = serverless(app);
export default app;
