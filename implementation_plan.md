# Enhanced Implementation Plan — Advitiyans Student 360°, Faculty & Admin Platform (AWS)

Build a full-stack, production-grade web application (**Advitiyans**) for Student Information, Placement Readiness, Faculty Mentoring, and Placement Cell Administration deployed on AWS serverless architecture.

---

## 1. Multi-Role Scope & Permissions Matrix

| Role | Access & Dashboard Capabilities |
|---|---|
| **Student** | Self-service signup/login (`/login`), Dashboard (`/dashboard`) with completion ring & nudge cards, Profile (`/profile`) with 8 read/write tabs, employability score breakdown. Cannot touch other students' data. |
| **Faculty / Mentor** | Login (`/login`), Faculty Dashboard (`/faculty/dashboard`), assigned Mentee Directory with search/filters, department reports, full view/edit access to assigned mentees' academics, faculty remarks, and skill verifications. |
| **Admin / Placement Cell** | Login (`/login`), Admin Dashboard (`/admin/dashboard`), full Student Directory CRUD (add, view, edit all fields, delete), status inspection across departments/batches, Placement Analytics & CSV export, Faculty & Mentor assignment. |

---

## 2. Updated API Surface & Endpoint Mapping

```
POST   /students                 (admin) create student
GET    /students                 (admin/faculty) list/search/filter students by dept, batch, section, mentor
GET    /students/{id}            (self, mentor, admin) get full profile
PUT    /students/{id}            (self, mentor, admin) update student profile & remarks
DELETE /students/{id}            (admin) delete student record

GET    /students/{id}/academics
POST   /students/{id}/academics
GET    /students/{id}/coding-profiles
POST   /students/{id}/coding-profiles
GET    /students/{id}/tech-skills
POST   /students/{id}/tech-skills
GET    /students/{id}/certifications
POST   /students/{id}/certifications
GET    /students/{id}/soft-skills
POST   /students/{id}/soft-skills
GET    /students/{id}/achievements
POST   /students/{id}/achievements
GET    /students/{id}/placement-profile
PUT    /students/{id}/placement-profile

GET    /students/{id}/employability-score     compute + return score breakdown
GET    /students/{id}/upload-url               returns S3 pre-signed URL for uploads

GET    /faculty/{id}/mentees                     (faculty) list assigned mentees
GET    /reports/department/{dept}                (admin/faculty) department GPA & skill analytics
GET    /reports/placement-summary                 (admin) placement categories & CSV data

GET    /auth/check-availability                  (public) registration number & email availability check
GET    /health                                   (public) API health check
```

---

## 3. Frontend Pages & Components Architecture

### 3.1 Role-Based Navigation
- **Student Navigation**: Dashboard, Personal & Academic, Coding Profiles, Tech Skills, Certifications, Soft Skills, Placement Readiness.
- **Faculty Navigation**: Faculty Dashboard, Mentee Directory, Department Reports.
- **Admin Navigation**: Admin Dashboard, Student Directory (CRUD), Placement Analytics, User & Mentor Management.

### 3.2 Key Dashboard Specifications

#### 1. Student Dashboard (`/dashboard`)
- 60/40 split layout. GreetingHero, StatCards (Employability Score, Certs, Coding Profiles, Skills Tracked), Skill Snapshot Radar chart, Recent Achievements timeline, Complete Your Profile prompt nudge cards.

#### 2. Faculty Dashboard (`/faculty/dashboard`)
- StatCards: Assigned Mentee Count, Avg Mentee GPA, Avg Employability Score, Pending Reviews.
- Mentee Directory Table: Search by roll number/name, filter by section/batch, status badges (Employability Score, Completion %), Quick View/Edit action.
- Mentee Evaluation Drawer: Edit faculty remarks, verify tech skills, rate soft skills.

#### 3. Admin / Placement Cell Dashboard (`/admin/dashboard`)
- Institution StatCards: Total Registered Students, Dept Breakdown, Placement Eligible Students (Score ≥ 80%), Avg Institution Score.
- Full Student Directory CRUD:
  - Search bar + filters (Department, Batch, Section, Employability Status).
  - Add New Student modal.
  - Edit Student modal (Full administrative authority to modify any field).
  - Delete Student confirmation.
  - Quick status check modal (complete 360° summary card).
- Placement Analytics: Top dream companies, skill gap breakdown, export to CSV.

---

## 4. Proposed File Modifications & Additions

### Backend & API
- **`backend/src/handlers/api.ts`**: Add `GET /students` (with query filtering for dept, batch, search), `DELETE /students/:id`, `GET /faculty/:id/mentees`, `GET /reports/department/:dept`, and `GET /reports/placement-summary`.

### Frontend Components
- **`frontend/src/components/layout/Sidebar.tsx`**: Update sidebar navigation to be fully role-aware (Student vs Faculty vs Admin).
- **`frontend/src/features/auth/AuthPage.tsx`**: Support seamless one-click demo login for Student (`jayanth@rgmcet.edu.in`), Faculty (`mramesh@rgmcet.edu.in`), and Admin (`admin@rgmcet.edu.in`).
- **`frontend/src/features/faculty/FacultyDashboardPage.tsx`**: New Faculty Dashboard with Mentee Directory and evaluation controls.
- **`frontend/src/features/admin/AdminDashboardPage.tsx`**: New Admin Dashboard with Student Directory CRUD, Add/Edit/Delete modals, and Placement Analytics CSV export.
- **`frontend/src/App.tsx`**: Route handling for `/dashboard` (Student), `/faculty/dashboard` (Faculty), and `/admin/dashboard` (Admin).

---

## 5. Verification Plan

1. **Role Access Testing**:
   - Log in as **Student**: Verifies `/dashboard` and `/profile`.
   - Log in as **Faculty**: Redirects to `/faculty/dashboard`, displays assigned mentees, allows editing remarks and verifying skills.
   - Log in as **Admin**: Redirects to `/admin/dashboard`, provides full CRUD table (Add student, Edit any student field, Delete student, Export CSV).
2. **TypeScript Compilation**:
   - Re-run `npm run build` in `/backend` and `/frontend` to ensure 0 compiler errors.
