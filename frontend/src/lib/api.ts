import {
  StudentProfile,
  AcademicRecord,
  CodingProfile,
  TechSkill,
  Certification,
  SoftSkill,
  Achievement,
  PlacementProfile,
  ScoreBreakdown,
} from '../types';
import { getIdToken } from './cognitoAuth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://caam6j4dbh.execute-api.ap-south-1.amazonaws.com/prod';

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  // ── Token resolution priority ──────────────────────────────────────────────
  // 1. sessionStorage JWT (tab-isolated, set on login)
  // 2. Cognito session (student/faculty real JWT — only if no sessionStorage token)
  //
  // IMPORTANT: Never fall through to Cognito if we already have a token in
  // sessionStorage. Admin/HOD use demo_token_admin_... stored in sessionStorage.
  // Cognito's shared localStorage may still hold a student's JWT from a previous
  // login on the same browser — using it would override admin's role to "student".
  // ─────────────────────────────────────────────────────────────────────────────

  // Check sessionStorage first — it's tab-isolated and authoritative
  const sessionToken = sessionStorage.getItem('advitiyans_jwt_token');

  let token: string | null = sessionToken;

  let userEmail = '';
  let userRole = '';
  try {
    const savedUser = sessionStorage.getItem('advitiyans_auth_user');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      userEmail = parsed.email || '';
      userRole = parsed.role || '';
    }
  } catch { /* ignore */ }

  // Only fall back to Cognito if sessionStorage has nothing (fresh page load for students)
  if (!token) {
    // HOD/Admin use demo tokens — Cognito would return null or a wrong-role token.
    // Reconstruct the demo token directly from the saved user rather than hitting Cognito.
    if ((userRole === 'hod' || userRole === 'admin') && userEmail) {
      token = `demo_token_${userRole}_${encodeURIComponent(userEmail)}_${Date.now()}`;
      // Restore it to sessionStorage so subsequent requests don't need to reconstruct
      sessionStorage.setItem('advitiyans_jwt_token', token);
    } else {
      try {
        token = await getIdToken();
      } catch { /* ignore */ }
    }
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(userEmail ? { 'X-Caller-Email': userEmail } : {}),
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(errorData.message || errorData.error || 'API Request failed');
    }
    return await response.json();
  } catch (err) {
    console.warn(`[API] Network call to ${endpoint} failed, utilizing local fallback state.`);
    throw err;
  }
}

export const api = {
  // Auth Availability
  checkAvailability: async (type: 'email' | 'regNo', value: string) => {
    return fetchWithAuth(`/auth/check-availability?type=${type}&value=${encodeURIComponent(value)}`);
  },

  // My Mentor — student-facing: returns assigned mentor details + faculty remarks
  getMyMentor: async (): Promise<{
    assigned: boolean;
    faculty_id?: string;
    name?: string;
    email?: string | null;
    department?: string;
    role?: string;
    remarks?: string | null;
  }> => {
    return fetchWithAuth('/student/mentor');
  },

  // Single-Session Enforcement
  // Called immediately after login to register the session token with the backend.
  // This overwrites any existing session for this email, kicking out other devices.
  registerSession: async (email: string, sessionToken: string, role: string): Promise<{ success: boolean }> => {
    try {
      return await fetchWithAuth('/auth/session', {
        method: 'POST',
        body: JSON.stringify({ email, session_token: sessionToken, role }),
      });
    } catch {
      return { success: false };
    }
  },

  // Check whether this session_token is still the active session for the given email.
  // Returns { valid: true } if OK, { valid: false, reason: string } if superseded/expired.
  validateSession: async (email: string, sessionToken: string): Promise<{ valid: boolean; reason?: string }> => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/auth/validate-session?email=${encodeURIComponent(email)}&session_token=${encodeURIComponent(sessionToken)}`
      );
      if (!res.ok) return { valid: true }; // network errors: be lenient, don't kick out
      return await res.json();
    } catch {
      return { valid: true }; // network errors: be lenient, don't kick out
    }
  },
  // Admin & HOD Login — credentials validated server-side (never stored in frontend)
  adminLogin: async (email: string, password: string, department?: string): Promise<{ valid: boolean; role?: 'admin' | 'hod'; isSuperAdmin?: boolean; department?: string; error?: string }> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s max
      const res = await fetch(`${API_BASE_URL}/auth/admin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, department }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return await res.json();
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { valid: false, error: 'Login timed out. Please try again — Lambda may be warming up.' };
      }
      return { valid: false, error: 'Could not reach authentication server. Please check your connection.' };
    }
  },


  // Faculty/HOD Registration Key Validation (SEC-01 fix: validated server-side)
  validateFacultyKey: async (securityKey: string): Promise<{ valid: boolean; error?: string }> => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/validate-faculty-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ securityKey }),
      });
      return await res.json();
    } catch {
      return { valid: false, error: 'Could not reach the server. Please try again.' };
    }
  },

  getAllStudents: async (params?: { department?: string; batch?: string; section?: string; search?: string }): Promise<StudentProfile[]> => {
    const query = new URLSearchParams(params as any).toString();
    return fetchWithAuth(`/students${query ? `?${query}` : ''}`);
  },

  createStudent: async (data: Partial<StudentProfile>): Promise<{ message: string; student: StudentProfile }> => {
    return fetchWithAuth(`/students`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  deleteStudent: async (id: string): Promise<{ message: string }> => {
    return fetchWithAuth(`/students/${id}`, {
      method: 'DELETE',
    });
  },

  bulkDeleteStudents: async (rollNumbers: string[]): Promise<{ deleted: number; message: string }> => {
    return fetchWithAuth('/admin/students/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ roll_numbers: rollNumbers }),
    });
  },

  deleteAllStudents: async (): Promise<{ message: string }> => {
    return fetchWithAuth('/students', { method: 'DELETE' });
  },

  getStudentByEmail: async (email: string): Promise<StudentProfile | null> => {
    try {
      return await fetchWithAuth(`/students/by-email/${encodeURIComponent(email)}`);
    } catch {
      return null;
    }
  },

  // Student Profile
  getStudentProfile: async (id: string): Promise<StudentProfile> => {
    return fetchWithAuth(`/students/${id}`);
  },

  updateStudentProfile: async (id: string, data: Partial<StudentProfile>): Promise<StudentProfile> => {
    return fetchWithAuth(`/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Sub-resources
  getAcademics: async (id: string): Promise<AcademicRecord[]> => {
    return fetchWithAuth(`/students/${id}/academics`);
  },

  saveAcademicRecord: async (id: string, data: AcademicRecord): Promise<AcademicRecord[]> => {
    return fetchWithAuth(`/students/${id}/academics`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getCodingProfiles: async (id: string): Promise<CodingProfile[]> => {
    return fetchWithAuth(`/students/${id}/coding-profiles`);
  },

  saveCodingProfile: async (id: string, data: CodingProfile): Promise<CodingProfile[]> => {
    return fetchWithAuth(`/students/${id}/coding-profiles`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  deleteCodingProfile: async (id: string, platform: string): Promise<CodingProfile[]> => {
    return fetchWithAuth(`/students/${id}/coding-profiles/${encodeURIComponent(platform)}`, {
      method: 'DELETE',
    });
  },

  getLeetCodeStats: async (handle: string): Promise<any> => {
    return fetchWithAuth(`/proxy/leetcode/${encodeURIComponent(handle)}`);
  },

  getTechSkills: async (id: string): Promise<TechSkill[]> => {
    return fetchWithAuth(`/students/${id}/tech-skills`);
  },

  saveTechSkill: async (id: string, data: TechSkill): Promise<TechSkill[]> => {
    return fetchWithAuth(`/students/${id}/tech-skills`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getCertifications: async (id: string): Promise<Certification[]> => {
    return fetchWithAuth(`/students/${id}/certifications`);
  },

  saveCertification: async (id: string, data: Certification): Promise<Certification[]> => {
    return fetchWithAuth(`/students/${id}/certifications`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateCertification: async (id: string, certId: string, data: Certification): Promise<Certification[]> => {
    return fetchWithAuth(`/students/${id}/certifications/${certId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteCertification: async (id: string, certId: string): Promise<Certification[]> => {
    return fetchWithAuth(`/students/${id}/certifications/${certId}`, {
      method: 'DELETE',
    });
  },

  getSoftSkills: async (id: string): Promise<SoftSkill[]> => {
    return fetchWithAuth(`/students/${id}/soft-skills`);
  },

  saveSoftSkill: async (id: string, data: SoftSkill): Promise<SoftSkill[]> => {
    return fetchWithAuth(`/students/${id}/soft-skills`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getAchievements: async (id: string): Promise<Achievement[]> => {
    return fetchWithAuth(`/students/${id}/achievements`);
  },

  saveAchievement: async (id: string, data: Achievement): Promise<Achievement[]> => {
    return fetchWithAuth(`/students/${id}/achievements`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getPlacementProfile: async (id: string): Promise<PlacementProfile> => {
    return fetchWithAuth(`/students/${id}/placement-profile`);
  },

  updatePlacementProfile: async (id: string, data: Partial<PlacementProfile>): Promise<PlacementProfile> => {
    return fetchWithAuth(`/students/${id}/placement-profile`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Employability Score
  getEmployabilityScore: async (id: string): Promise<ScoreBreakdown> => {
    return fetchWithAuth(`/students/${id}/employability-score`);
  },

  // Upload Presigned URL
  getUploadUrl: async (id: string, fileName: string, uploadType: string) => {
    return fetchWithAuth(`/students/${id}/upload-url?fileName=${encodeURIComponent(fileName)}&uploadType=${uploadType}`);
  },

  // Get View URL for existing files
  getViewUrl: async (id: string, fileKey: string) => {
    return fetchWithAuth(`/students/${id}/view-url?fileKey=${encodeURIComponent(fileKey)}`);
  },

  // Faculty Management
  createFaculty: async (data: { faculty_id: string; name: string; email: string; department: string; role?: string }) => {
    return fetchWithAuth('/faculty', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getFacultyByEmail: async (email: string) => {
    return fetchWithAuth(`/faculty/by-email/${encodeURIComponent(email)}`);
  },

  // Faculty Mentees — by faculty_id
  getFacultyMentees: async (facultyId: string): Promise<any[]> => {
    return fetchWithAuth(`/faculty/${facultyId}/mentees`);
  },

  // Faculty Mentees — by email (resolves all records for same person across multiple faculty_ids)
  // Returns a StudentProfile[] array with an extra `.yearBreakdown` property attached.
  getMenteesByEmail: async (email: string): Promise<any[]> => {
    const resp = await fetchWithAuth(`/faculty/mentees/by-email/${encodeURIComponent(email)}`);
    // Backend now returns { mentees: [], yearBreakdown: {...}, total: n }
    // Stay backward-compatible: return the array but attach yearBreakdown for stat cards.
    if (resp && !Array.isArray(resp) && Array.isArray(resp.mentees)) {
      const arr: any[] = resp.mentees;
      (arr as any).yearBreakdown = resp.yearBreakdown || { '1st Year': 0, '2nd Year': 0, '3rd Year': 0, '4th Year': 0 };
      return arr;
    }
    // Old server or mock: plain array — compute breakdown locally
    const arr: any[] = Array.isArray(resp) ? resp : [];
    (arr as any).yearBreakdown = {
      '1st Year': arr.filter((m: any) => m.year === '1st Year').length,
      '2nd Year': arr.filter((m: any) => m.year === '2nd Year').length,
      '3rd Year': arr.filter((m: any) => m.year === '3rd Year').length,
      '4th Year': arr.filter((m: any) => m.year === '4th Year').length,
    };
    return arr;
  },

  // Get all faculty with mentee counts (admin)
  getAllFaculty: async (): Promise<any[]> => {
    return fetchWithAuth(`/faculty`);
  },

  // Link email to faculty record (admin)
  patchFacultyEmail: async (facultyId: string, email: string): Promise<any> => {
    return fetchWithAuth(`/faculty/${facultyId}/email`, {
      method: 'PATCH',
      body: JSON.stringify({ email }),
    });
  },

  // Update faculty display name (admin)
  patchFacultyName: async (facultyId: string, name: string): Promise<any> => {
    return fetchWithAuth(`/faculty/${facultyId}/name`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
  },

  // Delete a faculty record (admin) — also blocks their email
  deleteFaculty: async (facultyId: string): Promise<any> => {
    return fetchWithAuth(`/faculty/${facultyId}`, { method: 'DELETE' });
  },

  // Get detailed mentee list for a specific faculty (admin)
  getFacultyMenteeList: async (facultyId: string): Promise<any[]> => {
    return fetchWithAuth(`/faculty/${encodeURIComponent(facultyId)}/mentees-detail`);
  },

  // Unblock a faculty email so they can re-register (admin)
  unblockFaculty: async (email: string): Promise<any> => {
    return fetchWithAuth(`/faculty/unblock/${encodeURIComponent(email)}`, { method: 'POST' });
  },

  // Get list of all blocked emails (admin)
  getBlockedEmails: async (): Promise<any[]> => {
    return fetchWithAuth(`/faculty/blocked`);
  },

  // Unassign a student from a faculty mentor (admin)
  unassignMentee: async (facultyId: string, rollNumber: string): Promise<any> => {
    return fetchWithAuth(`/mentor-assignments/${encodeURIComponent(facultyId)}/${encodeURIComponent(rollNumber)}`, { method: 'DELETE' });
  },

  // Manually assign roll numbers to a faculty mentor (admin)
  addMenteesToFaculty: async (facultyId: string, rolls: string[]): Promise<any> => {
    return fetchWithAuth(`/faculty/${encodeURIComponent(facultyId)}/mentees`, {
      method: 'POST',
      body: JSON.stringify({ rolls }),
    });
  },

  // Search students with assignment status for autocomplete (admin)
  searchAssignableStudents: async (query: string): Promise<any[]> => {
    return fetchWithAuth(`/students/search-assignable?q=${encodeURIComponent(query)}`);
  },

  // Upload mentor assignment CSV rows
  uploadMentorAssignments: async (rows: { rolls: string[]; facultyName: string }[]): Promise<any> => {
    return fetchWithAuth(`/mentor-assignments/upload`, {
      method: 'POST',
      body: JSON.stringify({ rows }),
    });
  },

  // Sync mentor_assignments → students.faculty_mentor_id (admin utility, idempotent)
  syncMentorAssignments: async (): Promise<{ success: boolean; synced: number; cleared: number; message: string }> => {
    return fetchWithAuth(`/mentor-assignments/sync`, { method: 'POST' });
  },

  // Departments
  getDepartments: async (): Promise<{ code: string; name: string; short_name: string }[]> => {
    return fetchWithAuth(`/departments`);
  },

  // Reports & Analytics
  getDepartmentReport: async (dept?: string) => {
    return fetchWithAuth(`/reports/department/${dept ? encodeURIComponent(dept) : ''}`);
  },

  getHodAnalytics: async (dept?: string) => {
    const q = dept ? `?department=${encodeURIComponent(dept)}` : '';
    return fetchWithAuth(`/reports/hod-analytics${q}`);
  },

  getPlacementSummary: async (dept?: string) => {
    const q = dept ? `?department=${encodeURIComponent(dept)}` : '';
    return fetchWithAuth(`/reports/placement-summary${q}`);
  },

  bulkImportStudents: async (students: any[]) => {
    return fetchWithAuth(`/students/bulk-import`, {
      method: 'POST',
      body: JSON.stringify({ students }),
    });
  },

  triggerCronSync: async () => {
    return fetchWithAuth(`/reports/cron-sync`, {
      method: 'POST',
    });
  },

  // HOD Credential Management
  // Fetch current HOD email & password (admin-facing — shows DB override or env default)
  getHodCredentials: async (department?: string): Promise<{ email: string; password: string; department: string; source: string; updated_at: string | null }> => {
    const q = department ? `?department=${encodeURIComponent(department)}` : '';
    return fetchWithAuth(`/auth/hod-credentials${q}`);
  },

  // HOD updates their own email/password — no current password required
  updateHodCredentials: async (newEmail?: string, newPassword?: string, department?: string): Promise<{ success: boolean; message: string; email: string }> => {
    return fetchWithAuth('/auth/hod-credentials', {
      method: 'PUT',
      body: JSON.stringify({ new_email: newEmail || undefined, new_password: newPassword || undefined, department }),
    });
  },

  // Admin resets HOD credentials without needing the current password
  adminResetHodCredentials: async (newEmail?: string, newPassword?: string, department?: string): Promise<{ success: boolean; message: string; email: string }> => {
    return fetchWithAuth('/auth/hod-credentials/admin-reset', {
      method: 'POST',
      body: JSON.stringify({ new_email: newEmail || undefined, new_password: newPassword || undefined, department }),
    });
  },

  // Semester unlock settings
  getSemesterUnlockSettings: async (): Promise<{ year_label: string; max_semester: number }[]> => {
    return fetchWithAuth('/settings/semester-unlock');
  },

  updateSemesterUnlock: async (yearLabel: string, maxSemester: number): Promise<{ year_label: string; max_semester: number; deleted_count?: number }> => {
    return fetchWithAuth('/settings/semester-unlock', {
      method: 'PUT',
      body: JSON.stringify({ year_label: yearLabel, max_semester: maxSemester }),
    });
  },

  // Admin student password management
  getStudentPasswords: async (): Promise<{ roll_number: string; name: string; email: string; year: string; section: string; password: string }[]> => {
    return fetchWithAuth('/admin/student-passwords');
  },

  setStudentPassword: async (rollNo: string, password: string): Promise<{ success: boolean }> => {
    return fetchWithAuth(`/students/${rollNo}/password`, {
      method: 'PUT',
      body: JSON.stringify({ password }),
    });
  },

  // ── Super Admin: Manage Regular Admins ──────────────────────────────────────
  // callerEmail is sent with every request; backend validates it against super_admin_credentials.

  getSuperAdminAdmins: async (callerEmail: string): Promise<{ email: string; name: string; password: string; created_by: string; created_at: string }[]> => {
    return fetchWithAuth(`/super-admin/admins?caller_email=${encodeURIComponent(callerEmail)}`);
  },

  createAdmin: async (callerEmail: string, name: string, email: string, password: string, department?: string): Promise<{ success: boolean }> => {
    return fetchWithAuth('/super-admin/admins', {
      method: 'POST',
      body: JSON.stringify({ caller_email: callerEmail, name, email, password, department }),
    });
  },

  deleteAdmin: async (callerEmail: string, targetEmail: string): Promise<{ success: boolean }> => {
    return fetchWithAuth(`/super-admin/admins/${encodeURIComponent(targetEmail)}`, {
      method: 'DELETE',
      body: JSON.stringify({ caller_email: callerEmail }),
    });
  },

  setAdminPassword: async (callerEmail: string, targetEmail: string, password: string): Promise<{ success: boolean }> => {
    return fetchWithAuth(`/super-admin/admins/${encodeURIComponent(targetEmail)}/password`, {
      method: 'PUT',
      body: JSON.stringify({ caller_email: callerEmail, password }),
    });
  },

  // Super admin changes ONLY their own password (my_email scoped server-side)
  changeSuperAdminMyPassword: async (myEmail: string, newPassword: string): Promise<{ success: boolean }> => {
    return fetchWithAuth('/super-admin/my-password', {
      method: 'PUT',
      body: JSON.stringify({ my_email: myEmail, new_password: newPassword }),
    });
  },
};
