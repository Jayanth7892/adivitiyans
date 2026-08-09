import { z } from 'zod';

// Registration Number Regex: YY (2 digits) + 09 (college) + 1A/5A (edu) + 32 (dept) + XX (2 alphanumeric)
export const REGISTRATION_NUMBER_REGEX = /^\d{2}09(1[Aa]|5[Aa])32[A-Za-z0-9]{2}$/;
export const RGMCET_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@rgmcet\.edu\.in$/i;

export const registrationNumberSchema = z.string()
  .trim()
  .regex(REGISTRATION_NUMBER_REGEX, {
    message: "Must match format: YY09(1A|5A)32XX (e.g. 23091A32A5).",
  })
  .transform((val) => val.toUpperCase());

export const emailSchema = z.string()
  .trim()
  .regex(RGMCET_EMAIL_REGEX, {
    message: "Email must be a valid @rgmcet.edu.in address.",
  })
  .transform((val) => val.toLowerCase());

export const studentSignUpSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters").max(100),
  registrationNumber: registrationNumberSchema,
  year: z.enum(['1st Year', '2nd Year', '3rd Year', '4th Year']),
  email: emailSchema,
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Za-z]/, "Password must contain at least one letter")
    .regex(/\d/, "Password must contain at least one number"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const studentProfileSchema = z.object({
  name: z.string().min(2).max(100),
  roll_number: registrationNumberSchema,
  email: emailSchema,
  year: z.enum(['1st Year', '2nd Year', '3rd Year', '4th Year']),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  native_place: z.string().optional().nullable(),
  department: z.string().default('CSE'),
  batch: z.string().default('2023-2027'),
  section: z.string().default('A'),
  hostel_day_scholar: z.enum(['Hostel', 'Day Scholar']).default('Day Scholar'),
  driving_license: z.boolean().default(false),
  passport: z.boolean().default(false),
  relocation_willingness: z.boolean().default(true),
  family_business: z.string().optional().nullable(),
  financial_background: z.string().optional().nullable(),
  faculty_mentor_id: z.string().optional().nullable(),
  photo_url: z.string().url().optional().nullable(),
  resume_url: z.string().url().optional().nullable(),
  linkedin_url: z.string().url().optional().nullable(),
});

export const academicSchema = z.object({
  semester: z.number().int().min(1).max(8),
  semester_gpa: z.number().min(0).max(10),
  programming_grade: z.string().optional().nullable(),
  attendance_pct: z.number().min(0).max(100),
  theory_grade: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

export const codingProfileSchema = z.object({
  platform: z.enum([
    'GitHub',
    'LeetCode',
    'GeeksforGeeks',
    'HackerRank',
    'Codeforces',
    'CodeChef',
    'Kaggle',
    'StackOverflow',
    'GSoC-LFX',
  ]),
  handle: z.string().min(1),
  streak: z.number().int().nonnegative().default(0),
  repositories_count: z.number().int().nonnegative().default(0),
  commits_count: z.number().int().nonnegative().default(0),
  prs_merged: z.number().int().nonnegative().default(0),
  score_rating: z.number().nonnegative().default(0),
});

export const techSkillSchema = z.object({
  skill_category: z.string().min(1),
  specific_tool: z.string().min(1),
  self_rating: z.number().int().min(1).max(5),
  verified: z.boolean().default(false),
});

export const certificationSchema = z.object({
  provider: z.string().min(1),
  title: z.string().min(1),
  date_completed: z.string().optional().nullable(),
  certificate_file_url: z.string().optional().nullable(),
  suggested: z.boolean().default(false),
});

export const softSkillSchema = z.object({
  skill: z.enum(['Leadership', 'Communication', 'Teamwork', 'Time Management', 'Public Speaking', 'Learning Ability', 'Professionalism']),
  rating: z.number().int().min(1).max(5),
  rated_by: z.enum(['self', 'faculty']).default('self'),
});

export const achievementSchema = z.object({
  type: z.enum(['Achievement', 'Failure-Learning', 'Challenge Overcome', 'Hackathon', 'Conference', 'Meetup', 'Capstone Project', 'Startup', 'Industry Project', 'Department Event', 'Club']),
  title: z.string().min(1),
  description: z.string().min(1),
  achievement_date: z.string().optional().nullable(),
  organization: z.string().optional().nullable(),
});

export const placementProfileSchema = z.object({
  placement_category: z.string().default('Product Companies'),
  preferred_career: z.string().default('AI & Full Stack Engineer'),
  dream_company: z.array(z.string()).default([]),
  higher_studies_interest: z.boolean().default(false),
  need_from_department: z.string().optional().nullable(),
});
