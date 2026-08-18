-- Advitiyans PostgreSQL Schema Definition
-- Database Schema for Student 360° & Placement Readiness Platform

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Faculty Table
CREATE TABLE IF NOT EXISTS faculty (
    faculty_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    department VARCHAR(50) NOT NULL,
    role VARCHAR(50) DEFAULT 'mentor' CHECK (role IN ('mentor', 'coordinator', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Students Table
-- Format constraint for roll_number: 10 chars (5 digits, 1 letter, '32', 2 digits)
-- Example: 23091A3251
CREATE TABLE IF NOT EXISTS students (
    roll_number VARCHAR(10) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    year VARCHAR(20) NOT NULL CHECK (year IN ('1st Year', '2nd Year', '3rd Year', '4th Year')),
    phone VARCHAR(20),
    address TEXT,
    native_place VARCHAR(100),
    department VARCHAR(50) NOT NULL DEFAULT 'CSE(Data Science)',
    batch VARCHAR(20) NOT NULL DEFAULT '',
    section VARCHAR(10) DEFAULT '',
    hostel_day_scholar VARCHAR(20) DEFAULT '',
    driving_license BOOLEAN DEFAULT FALSE,
    passport BOOLEAN DEFAULT FALSE,
    relocation_willingness BOOLEAN DEFAULT FALSE,
    family_business TEXT,
    financial_background VARCHAR(50),
    faculty_mentor_id VARCHAR(50) REFERENCES faculty(faculty_id) ON DELETE SET NULL,
    photo_url TEXT,
    resume_url TEXT,
    linkedin_url TEXT,
    linkedin_updated TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT check_roll_number_format CHECK (roll_number ~ '^\d{5}[A-Za-z]32\d{2}$'),
    CONSTRAINT check_rgmcet_email CHECK (email ~* '^[a-zA-Z0-9._%+-]+@rgmcet\.edu\.in$')
);

-- 3. Academics Table
CREATE TABLE IF NOT EXISTS academics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id VARCHAR(10) NOT NULL REFERENCES students(roll_number) ON DELETE CASCADE,
    semester INT NOT NULL CHECK (semester BETWEEN 1 AND 8),
    semester_gpa NUMERIC(4, 2) CHECK (semester_gpa BETWEEN 0.00 AND 10.00),
    programming_grade VARCHAR(5),
    attendance_pct NUMERIC(5, 2) CHECK (attendance_pct BETWEEN 0.00 AND 100.00),
    theory_grade VARCHAR(5),
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, semester)
);

-- 4. Coding Profiles Table
CREATE TABLE IF NOT EXISTS coding_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id VARCHAR(10) NOT NULL REFERENCES students(roll_number) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('GitHub', 'LeetCode', 'HackerRank', 'Kaggle', 'StackOverflow', 'GSoC-LFX')),
    handle VARCHAR(100) NOT NULL,
    streak INT DEFAULT 0,
    repositories_count INT DEFAULT 0,
    commits_count INT DEFAULT 0,
    prs_merged INT DEFAULT 0,
    score_rating NUMERIC(10, 2) DEFAULT 0.00,
    last_synced TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, platform)
);

-- 5. Tech Skills Table
CREATE TABLE IF NOT EXISTS tech_skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id VARCHAR(10) NOT NULL REFERENCES students(roll_number) ON DELETE CASCADE,
    skill_category VARCHAR(100) NOT NULL,
    specific_tool VARCHAR(100) NOT NULL,
    self_rating INT NOT NULL CHECK (self_rating BETWEEN 1 AND 5),
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, specific_tool)
);

-- 6. Certifications Table
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

-- 7. Soft Skills Table
CREATE TABLE IF NOT EXISTS soft_skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id VARCHAR(10) NOT NULL REFERENCES students(roll_number) ON DELETE CASCADE,
    skill VARCHAR(100) NOT NULL CHECK (skill IN ('Leadership', 'Communication', 'Teamwork', 'Time Management', 'Public Speaking', 'Learning Ability', 'Professionalism')),
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    rated_by VARCHAR(20) DEFAULT 'self' CHECK (rated_by IN ('self', 'faculty')),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, skill, rated_by)
);

-- 8. Extracurriculars Table
CREATE TABLE IF NOT EXISTS extracurriculars (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id VARCHAR(10) NOT NULL REFERENCES students(roll_number) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL CHECK (category IN ('Sport', 'Music', 'Dance', 'Photography', 'Art', 'Writing', 'Content Creation', 'Other')),
    description TEXT NOT NULL,
    level VARCHAR(50) DEFAULT 'college' CHECK (level IN ('college', 'state', 'national', 'international')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Achievements Table
CREATE TABLE IF NOT EXISTS achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id VARCHAR(10) NOT NULL REFERENCES students(roll_number) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('Achievement', 'Failure-Learning', 'Challenge Overcome', 'Hackathon', 'Conference', 'Meetup', 'Capstone Project', 'Startup', 'Industry Project', 'Department Event', 'Club')),
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    achievement_date DATE,
    organization VARCHAR(150),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Placement Profile Table
CREATE TABLE IF NOT EXISTS placement_profile (
    student_id VARCHAR(10) PRIMARY KEY REFERENCES students(roll_number) ON DELETE CASCADE,
    placement_category VARCHAR(100) DEFAULT 'Product Companies',
    preferred_career VARCHAR(100) DEFAULT 'AI & Full Stack Engineer',
    dream_company TEXT[] DEFAULT ARRAY['Google', 'Microsoft', 'Amazon'],
    employability_score NUMERIC(5, 2) DEFAULT 85.50,
    skill_gap JSONB DEFAULT '[]'::jsonb,
    suggested_certifications JSONB DEFAULT '[]'::jsonb,
    higher_studies_interest BOOLEAN DEFAULT FALSE,
    overall_potential NUMERIC(3, 1) DEFAULT 4.5 CHECK (overall_potential BETWEEN 1.0 AND 5.0),
    research_potential NUMERIC(3, 1) DEFAULT 4.0 CHECK (research_potential BETWEEN 1.0 AND 5.0),
    need_from_department TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Users Sync Table (Cognito mapped)
CREATE TABLE IF NOT EXISTS users (
    cognito_sub VARCHAR(100) PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'faculty', 'admin')),
    roll_number VARCHAR(10) REFERENCES students(roll_number) ON DELETE SET NULL,
    faculty_id VARCHAR(50) REFERENCES faculty(faculty_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. Mentor Assignments — source of truth for faculty–student mentor relationships.
-- One mentor per student (PRIMARY KEY on roll_number).
-- Admin uploads a CSV → rows inserted here; faculty dashboard reads from here.
CREATE TABLE IF NOT EXISTS mentor_assignments (
    roll_number  VARCHAR(10) NOT NULL PRIMARY KEY REFERENCES students(roll_number) ON DELETE CASCADE,
    faculty_id   VARCHAR(50) NOT NULL REFERENCES faculty(faculty_id) ON DELETE CASCADE,
    assigned_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_students_dept_batch ON students(department, batch);
CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);
CREATE INDEX IF NOT EXISTS idx_academics_student ON academics(student_id);
CREATE INDEX IF NOT EXISTS idx_coding_profiles_student ON coding_profiles(student_id);
CREATE INDEX IF NOT EXISTS idx_tech_skills_student ON tech_skills(student_id);
CREATE INDEX IF NOT EXISTS idx_certifications_student ON certifications(student_id);
CREATE INDEX IF NOT EXISTS idx_achievements_student ON achievements(student_id);

-- ============================================================================
-- SAMPLE SEED DATA (5 Students across Departments, Years, and Complete Records)
-- ============================================================================

-- Insert Faculty
INSERT INTO faculty (faculty_id, name, email, department, role) VALUES
('FAC001', 'Dr. K. V. Subbaiah', 'kvsubbaiah@rgmcet.edu.in', 'CSE', 'coordinator'),
('FAC002', 'Prof. M. Ramesh', 'mramesh@rgmcet.edu.in', 'ECE', 'mentor')
ON CONFLICT (faculty_id) DO NOTHING;

-- End of schema.sql
