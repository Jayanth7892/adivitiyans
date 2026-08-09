import { z } from 'zod';

/**
 * Registration Number format (10 chars):
 *   Pos 1-2: Year (any 2 digits, e.g. 23 = 2023)
 *   Pos 3-4: College code — must be '09'
 *   Pos 5-6: Education type — must be '1A' (inter) or '5A' (polytechnic/FDH/diploma)
 *   Pos 7-8: Department ID — must be '32' (Data Science)
 *   Pos 9-10: Student ID — alphanumeric (e.g. 01, A5, KK, P4, ZZ)
 */
export const REGISTRATION_NUMBER_REGEX = /^\d{2}09[15][Aa]32[A-Za-z0-9]{2}$/;
export const RGMCET_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@rgmcet\.edu\.in$/i;

export const studentSignUpSchema = z.object({
  fullName: z.string()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name cannot exceed 100 characters"),
  registrationNumber: z.string()
    .trim()
    .regex(REGISTRATION_NUMBER_REGEX, {
      message: "Invalid format. Must be: YY09(1A|5A)32XX (e.g. 23091A32A5)",
    })
    .transform((val) => val.toUpperCase()),
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
}).refine((data) => {
  // Email prefix must match registration number (case-insensitive)
  const emailPrefix = data.email.split('@')[0].toLowerCase();
  return emailPrefix === data.registrationNumber.toLowerCase();
}, {
  message: "Email must match your registration number (e.g. 23091a32a5@rgmcet.edu.in)",
  path: ["email"],
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const loginSchema = z.object({
  email: z.string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const facultySignUpSchema = z.object({
  fullName: z.string()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name cannot exceed 100 characters"),
  department: z.string().min(1, "Please select department"),
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
