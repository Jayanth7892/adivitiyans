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
    department VARCHAR(50) NOT NULL DEFAULT 'CSE',
    batch VARCHAR(20) NOT NULL DEFAULT '2022-2026',
    section VARCHAR(10) DEFAULT 'A',
    hostel_day_scholar VARCHAR(20) DEFAULT 'Day Scholar' CHECK (hostel_day_scholar IN ('Hostel', 'Day Scholar')),
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

-- Insert Students
INSERT INTO students (
    roll_number, name, email, year, phone, address, native_place, department, batch, section,
    hostel_day_scholar, driving_license, passport, relocation_willingness, family_business,
    financial_background, faculty_mentor_id, linkedin_url
) VALUES
('23091A3251', 'Jayanth Kumar', 'jayanth@rgmcet.edu.in', '3rd Year', '9876543210', 'Nandyal, Andhra Pradesh', 'Nandyal', 'CSE', '2023-2027', 'A', 'Day Scholar', TRUE, TRUE, TRUE, 'Agriculture', 'Middle Class', 'FAC001', 'https://linkedin.com/in/jayanth-kumar'),
('23091A3252', 'Ananya Sharma', 'ananya@rgmcet.edu.in', '3rd Year', '9876543211', 'Kurnool, Andhra Pradesh', 'Kurnool', 'CSE', '2023-2027', 'B', 'Hostel', FALSE, TRUE, TRUE, 'Retail Business', 'Upper Middle Class', 'FAC001', 'https://linkedin.com/in/ananya-sharma'),
('23091A3253', 'Vikram Reddy', 'vikram@rgmcet.edu.in', '4th Year', '9876543212', 'Tirupati, Andhra Pradesh', 'Tirupati', 'ECE', '2022-2026', 'A', 'Day Scholar', TRUE, FALSE, TRUE, 'Engineering Services', 'Middle Class', 'FAC002', 'https://linkedin.com/in/vikram-reddy'),
('23091A3254', 'Sneha Patel', 'sneha@rgmcet.edu.in', '2nd Year', '9876543213', 'Vijayawada, Andhra Pradesh', 'Vijayawada', 'CSE', '2024-2028', 'C', 'Hostel', TRUE, TRUE, TRUE, 'Pharma Supply', 'Upper Middle Class', 'FAC001', 'https://linkedin.com/in/sneha-patel'),
('23091A3255', 'Rahul Verma', 'rahul@rgmcet.edu.in', '4th Year', '9876543214', 'Guntur, Andhra Pradesh', 'Guntur', 'EEE', '2022-2026', 'B', 'Day Scholar', FALSE, FALSE, FALSE, 'Textiles', 'Middle Class', 'FAC002', 'https://linkedin.com/in/rahul-verma')
ON CONFLICT (roll_number) DO NOTHING;

-- Insert Academics for Jayanth (23091A3251)
INSERT INTO academics (student_id, semester, semester_gpa, programming_grade, attendance_pct, theory_grade, remarks) VALUES
('23091A3251', 1, 8.80, 'A+', 94.50, 'A', 'Excellent performance in C Programming'),
('23091A3251', 2, 9.10, 'O', 96.00, 'A+', 'Outstanding in Data Structures'),
('23091A3251', 3, 9.30, 'O', 95.00, 'O', 'Top rank in Java & Algorithms'),
('23091A3251', 4, 9.45, 'O', 98.00, 'O', 'Top score in Database Systems')
ON CONFLICT (student_id, semester) DO NOTHING;

-- Insert Coding Profiles for Jayanth (23091A3251)
INSERT INTO coding_profiles (student_id, platform, handle, streak, repositories_count, commits_count, prs_merged, score_rating) VALUES
('23091A3251', 'GitHub', 'jayanth-dev', 42, 28, 480, 15, 1250.00),
('23091A3251', 'LeetCode', 'jayanth_leetcode', 65, 0, 320, 0, 1845.00),
('23091A3251', 'HackerRank', 'jayanth_hr', 12, 0, 85, 0, 920.00),
('23091A3251', 'Kaggle', 'jayanth_ml', 8, 5, 30, 0, 450.00)
ON CONFLICT (student_id, platform) DO NOTHING;

-- Insert Tech Skills for Jayanth (23091A3251)
INSERT INTO tech_skills (student_id, skill_category, specific_tool, self_rating, verified) VALUES
('23091A3251', 'AI/Agentic', 'Claude Code & CrewAI', 5, TRUE),
('23091A3251', 'Cloud', 'AWS Lambda & S3', 4, TRUE),
('23091A3251', 'Full Stack', 'React & TypeScript', 5, TRUE),
('23091A3251', 'Data Analytics', 'Python & Pandas', 4, FALSE),
('23091A3251', 'Cybersecurity', 'OWASP Top 10', 3, FALSE)
ON CONFLICT (student_id, specific_tool) DO NOTHING;

-- Insert Certifications for Jayanth (23091A3251)
INSERT INTO certifications (student_id, provider, title, date_completed, certificate_file_url, suggested) VALUES
('23091A3251', 'AWS', 'AWS Certified Solutions Architect Associate', '2024-03-15', 'https://s3.amazonaws.com/advitiyans/certs/aws-architect.pdf', FALSE),
('23091A3251', 'Coursera', 'Deep Learning Specialization by Andrew Ng', '2024-01-20', 'https://s3.amazonaws.com/advitiyans/certs/dl-spec.pdf', FALSE),
('23091A3251', 'NPTEL', 'Programming, Data Structures And Algorithms Using Python', '2023-11-10', NULL, TRUE)
ON CONFLICT DO NOTHING;

-- Insert Soft Skills for Jayanth (23091A3251)
INSERT INTO soft_skills (student_id, skill, rating, rated_by) VALUES
('23091A3251', 'Leadership', 5, 'self'),
('23091A3251', 'Communication', 4, 'self'),
('23091A3251', 'Teamwork', 5, 'self'),
('23091A3251', 'Time Management', 4, 'self'),
('23091A3251', 'Public Speaking', 4, 'self'),
('23091A3251', 'Learning Ability', 5, 'self'),
('23091A3251', 'Professionalism', 5, 'self')
ON CONFLICT (student_id, skill, rated_by) DO NOTHING;

-- Insert Extracurriculars for Jayanth (23091A3251)
INSERT INTO extracurriculars (student_id, category, description, level) VALUES
('23091A3251', 'Writing', 'Technical blogger on Medium writing about Agentic AI frameworks', 'national'),
('23091A3251', 'Content Creation', 'Lead organizer of college TechFest & Hackathon', 'college')
ON CONFLICT DO NOTHING;

-- Insert Achievements for Jayanth (23091A3251)
INSERT INTO achievements (student_id, type, title, description, achievement_date, organization) VALUES
('23091A3251', 'Hackathon', '1st Place in Smart India Hackathon 2024', 'Built an automated campus placement readiness analyzer using AI', '2024-02-18', 'AICTE'),
('23091A3251', 'Capstone Project', 'Advitiyans Student 360 Platform', 'Architected serverless cloud system for 3000+ university students', '2024-04-10', 'RGMCET'),
('23091A3251', 'Conference', 'Speaker at National AI Student Summit', 'Presented paper on LLM Agents in Higher Education', '2024-05-22', 'IEEE Student Chapter')
ON CONFLICT DO NOTHING;

-- Insert Placement Profile for Jayanth (23091A3251)
INSERT INTO placement_profile (
    student_id, placement_category, preferred_career, dream_company, employability_score,
    skill_gap, suggested_certifications, higher_studies_interest, overall_potential, research_potential, need_from_department
) VALUES (
    '23091A3251',
    'Product Companies',
    'AI & Full Stack Cloud Engineer',
    ARRAY['Google', 'Microsoft', 'Atlassian', 'AWS'],
    92.40,
    '["Deepen System Design experience", "Kubernetes cluster administration"]'::jsonb,
    '["AWS Certified Developer Associate", "CKAD - Certified Kubernetes Application Developer"]'::jsonb,
    FALSE,
    4.9,
    4.5,
    'Advanced mock interview sessions with industry alumni and sponsorship for Cloud Certification exams.'
) ON CONFLICT (student_id) DO NOTHING;
