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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://w8tlnuswea.execute-api.ap-south-1.amazonaws.com/prod';

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  // Prefer Cognito JWT, fallback to localStorage token
  let token: string | null = null;
  try {
    token = await getIdToken();
  } catch { /* ignore */ }
  if (!token) {
    token = localStorage.getItem('advitiyans_jwt_token');
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

  // Student Directory CRUD (Admin & Faculty)
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

  getStudentByEmail: async (email: string): Promise<StudentProfile | null> => {
    try {
      return await fetchWithAuth(`/students/by-email/${encodeURIComponent(email)}`);
    } catch {
      return null;
    }
  },

  // Student Profile
  getStudentProfile: async (id: string = '23091A3251'): Promise<StudentProfile> => {
    return fetchWithAuth(`/students/${id}`);
  },

  updateStudentProfile: async (id: string, data: Partial<StudentProfile>): Promise<StudentProfile> => {
    return fetchWithAuth(`/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Sub-resources
  getAcademics: async (id: string = '23091A3251'): Promise<AcademicRecord[]> => {
    return fetchWithAuth(`/students/${id}/academics`);
  },

  saveAcademicRecord: async (id: string, data: AcademicRecord): Promise<AcademicRecord[]> => {
    return fetchWithAuth(`/students/${id}/academics`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getCodingProfiles: async (id: string = '23091A3251'): Promise<CodingProfile[]> => {
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

  getTechSkills: async (id: string = '23091A3251'): Promise<TechSkill[]> => {
    return fetchWithAuth(`/students/${id}/tech-skills`);
  },

  saveTechSkill: async (id: string, data: TechSkill): Promise<TechSkill[]> => {
    return fetchWithAuth(`/students/${id}/tech-skills`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getCertifications: async (id: string = '23091A3251'): Promise<Certification[]> => {
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

  getSoftSkills: async (id: string = '23091A3251'): Promise<SoftSkill[]> => {
    return fetchWithAuth(`/students/${id}/soft-skills`);
  },

  saveSoftSkill: async (id: string, data: SoftSkill): Promise<SoftSkill[]> => {
    return fetchWithAuth(`/students/${id}/soft-skills`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getAchievements: async (id: string = '23091A3251'): Promise<Achievement[]> => {
    return fetchWithAuth(`/students/${id}/achievements`);
  },

  saveAchievement: async (id: string, data: Achievement): Promise<Achievement[]> => {
    return fetchWithAuth(`/students/${id}/achievements`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getPlacementProfile: async (id: string = '23091A3251'): Promise<PlacementProfile> => {
    return fetchWithAuth(`/students/${id}/placement-profile`);
  },

  updatePlacementProfile: async (id: string, data: Partial<PlacementProfile>): Promise<PlacementProfile> => {
    return fetchWithAuth(`/students/${id}/placement-profile`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Employability Score
  getEmployabilityScore: async (id: string = '23091A3251'): Promise<ScoreBreakdown> => {
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

  // Faculty Mentees
  getFacultyMentees: async (facultyId: string = 'FAC001'): Promise<StudentProfile[]> => {
    return fetchWithAuth(`/faculty/${facultyId}/mentees`);
  },

  // Reports & Analytics
  getDepartmentReport: async (dept: string = 'CSE(Data Science)') => {
    return fetchWithAuth(`/reports/department/${dept}`);
  },

  getHodAnalytics: async () => {
    return fetchWithAuth(`/reports/hod-analytics`);
  },

  getPlacementSummary: async () => {
    return fetchWithAuth(`/reports/placement-summary`);
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
};
