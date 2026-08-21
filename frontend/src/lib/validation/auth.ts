import { z } from 'zod';

// Registration Number Regex: 4 digits (e.g. 2309), entry type (1=regular, 5=lateral/FDH), 'A', department code (01-37), 2 alphanumeric chars
// Regular: 23091A0428  |  Lateral: 23095A0428
export const REGISTRATION_NUMBER_REGEX = /^\d{4}[15]A(01|02|03|04|05|32|33|34|37)[0-9A-Za-z]{2}$/i;
export const RGMCET_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@rgmcet\.edu\.in$/i;

// ── Department Code Map ─────────────────────────────────────────────────────
export const DEPARTMENT_CODE_MAP: Record<string, string> = {
  '01': 'Civil',
  '02': 'EEE',
  '03': 'Mechanical',
  '04': 'ECE',
  '05': 'CSE',
  '32': 'CSE (Data Science)',
  '33': 'CSE (AI & ML)',
  '34': 'CSE (BS)',
  '37': 'CSE (Cyber Security)',
};

export const VALID_DEPARTMENT_NAMES = Object.values(DEPARTMENT_CODE_MAP);

/** Extract the 2-character department code from a roll number (positions 6-7, 0-indexed) */
export function getDeptCodeFromRollNumber(rollNumber: string): string {
  return rollNumber.substring(6, 8);
}

/** Get department name from roll number */
export function getDeptFromRollNumber(rollNumber: string): string {
  const code = getDeptCodeFromRollNumber(rollNumber);
  return DEPARTMENT_CODE_MAP[code] || 'Unknown';
}

/** Check if a roll number indicates lateral entry (FDH) — position 4 is '5' */
export function isLateralEntry(rollNumber: string): boolean {
  return rollNumber.charAt(4) === '5';
}

export const studentSignUpSchema = z.object({
  fullName: z.string()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name cannot exceed 100 characters"),
  registrationNumber: z.string()
    .trim()
    .regex(REGISTRATION_NUMBER_REGEX, {
      message: "10 characters required (e.g. 23091A3251 or 23095A3251). Must contain a valid department code.",
    })
    .transform((val) => val.toUpperCase()),
  year: z.enum(['1st Year', '2nd Year', '3rd Year', '4th Year'], {
    required_error: "Please select your academic year",
  }),
  department: z.string().min(1, "Please select your department"),
  email: z.string()
    .trim()
    .regex(RGMCET_EMAIL_REGEX, {
      message: "Email must be a valid @rgmcet.edu.in address",
    })
    .transform((val) => val.toLowerCase()),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Za-z]/, "Must contain at least one letter")
    .regex(/\d/, "Must contain at least one number"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
}).refine((data) => {
  const expectedEmail = `${data.registrationNumber.toLowerCase()}@rgmcet.edu.in`;
  return data.email.toLowerCase() === expectedEmail;
}, {
  message: "Student email must match registration number (e.g. 23091a3205@rgmcet.edu.in)",
  path: ["email"],
}).refine((data) => {
  // Validate that the selected department matches the roll number code
  const deptCode = getDeptCodeFromRollNumber(data.registrationNumber.toUpperCase());
  const expectedDept = DEPARTMENT_CODE_MAP[deptCode];
  return expectedDept === data.department;
}, {
  message: "Selected department does not match your registration number. Please select the correct department.",
  path: ["department"],
});

export const loginSchema = z.object({
  email: z.string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  department: z.string().optional(),
});

export const facultySignUpSchema = z.object({
  fullName: z.string()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name cannot exceed 100 characters"),
  department: z.string().min(1, "Please select department"),
  securityKey: z.string().min(1, "Faculty secret passcode is required"),
  email: z.string()
    .trim()
    .regex(RGMCET_EMAIL_REGEX, {
      message: "Email must be a valid @rgmcet.edu.in address",
    })
    .transform((val) => val.toLowerCase()),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Za-z]/, "Must contain at least one letter")
    .regex(/\d/, "Must contain at least one number"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const hodSignUpSchema = facultySignUpSchema;

export type StudentSignUpInput = z.infer<typeof studentSignUpSchema>;
export type FacultySignUpInput = z.infer<typeof facultySignUpSchema>;
export type HodSignUpInput = z.infer<typeof hodSignUpSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
