export type UserRole = 'student' | 'faculty' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  rollNumber?: string;
  department?: string;
}

export interface StudentProfile {
  roll_number: string;
  name: string;
  email: string;
  year: '1st Year' | '2nd Year' | '3rd Year' | '4th Year';
  phone?: string;
  address?: string;
  native_place?: string;
  department: string;
  batch: string;
  section: string;
  hostel_day_scholar: 'Hostel' | 'Day Scholar';
  driving_license: boolean;
  passport: boolean;
  relocation_willingness: boolean;
  family_business?: string;
  financial_background?: string;
  faculty_mentor_id?: string;
  photo_url?: string;
  resume_url?: string;
  linkedin_url?: string;
  linkedin_updated?: string;
}

export interface AcademicRecord {
  id?: string;
  semester: number;
  semester_gpa: number;
  programming_grade?: string;
  attendance_pct: number;
  theory_grade?: string;
  remarks?: string;
}

export interface CodingProfile {
  id?: string;
  platform:
    | 'GitHub'
    | 'LeetCode'
    | 'GeeksforGeeks'
    | 'HackerRank'
    | 'Codeforces'
    | 'CodeChef'
    | 'Kaggle'
    | 'StackOverflow'
    | 'GSoC-LFX';
  handle: string;
  streak: number;
  repositories_count: number;
  commits_count: number;
  prs_merged: number;
  score_rating: number;
  last_synced?: string;
}

export interface TechSkill {
  id?: string;
  skill_category: string;
  specific_tool: string;
  self_rating: number;
  verified: boolean;
}

export interface Certification {
  id?: string;
  provider: string;
  title: string;
  date_completed?: string;
  certificate_file_url?: string;
  suggested?: boolean;
}

export interface SoftSkill {
  id?: string;
  skill: 'Leadership' | 'Communication' | 'Teamwork' | 'Time Management' | 'Public Speaking' | 'Learning Ability' | 'Professionalism';
  rating: number;
  rated_by: 'self' | 'faculty';
}

export interface Extracurricular {
  id?: string;
  category: 'Sport' | 'Music' | 'Dance' | 'Photography' | 'Art' | 'Writing' | 'Content Creation' | 'Other';
  description: string;
  level: 'college' | 'state' | 'national' | 'international';
}

export interface Achievement {
  id?: string;
  type: 'Achievement' | 'Failure-Learning' | 'Challenge Overcome' | 'Hackathon' | 'Conference' | 'Meetup' | 'Capstone Project' | 'Startup' | 'Industry Project' | 'Department Event' | 'Club';
  title: string;
  description: string;
  achievement_date?: string;
  organization?: string;
}

export interface PlacementProfile {
  student_id: string;
  placement_category: string;
  preferred_career: string;
  dream_company: string[];
  employability_score: number;
  skill_gap?: string[];
  suggested_certifications?: string[];
  higher_studies_interest: boolean;
  overall_potential?: number;
  research_potential?: number;
  need_from_department?: string;
}

export interface ScoreBreakdown {
  overallScore: number;
  academicsScore: number;
  codingScore: number;
  techSkillsScore: number;
  certsScore: number;
  softSkillsScore: number;
  achievementsScore: number;
  feedback: string[];
}
