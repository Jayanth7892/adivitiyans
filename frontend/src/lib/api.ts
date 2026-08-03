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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('advitiyans_jwt_token');
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

  // Faculty Mentees
  getFacultyMentees: async (facultyId: string = 'FAC001'): Promise<StudentProfile[]> => {
    return fetchWithAuth(`/faculty/${facultyId}/mentees`);
  },

  // Reports & Analytics
  getDepartmentReport: async (dept: string = 'CSE') => {
    return fetchWithAuth(`/reports/department/${dept}`);
  },

  getPlacementSummary: async () => {
    return fetchWithAuth(`/reports/placement-summary`);
  },
};
