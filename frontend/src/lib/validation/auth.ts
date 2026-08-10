import { z } from 'zod';

export const REGISTRATION_NUMBER_REGEX = /^\d{5}[A-Za-z]32\d{2}$/;
export const RGMCET_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@rgmcet\.edu\.in$/i;

export const studentSignUpSchema = z.object({
  fullName: z.string()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name cannot exceed 100 characters"),
  registrationNumber: z.string()
    .trim()
    .regex(REGISTRATION_NUMBER_REGEX, {
      message: "10 characters required (e.g. 23091A3251). Positions 7-8 must be '32'.",
    })
    .transform((val) => val.toUpperCase()),
  year: z.enum(['1st Year', '2nd Year', '3rd Year', '4th Year'], {
    required_error: "Please select your academic year",
  }),
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
