import { z } from "zod";

// Password policy referenced by both register and reset-password schemas.
// Kept here (not env.ts) since it's a fixed shape rule, not a deployment
// threshold like AUTH_MAX_FAILED_LOGIN_ATTEMPTS.
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters") // bcrypt's input limit
  .regex(/[a-zA-Z]/, "Password must include at least one letter")
  .regex(/[0-9]/, "Password must include at least one number");

// The public /register page is self-registration for students only
// (BR-008/015: a student belongs to exactly one college). BR-011
// ("only administrators may create... user accounts") governs
// staff/admin/vpaa/vpaf/osas accounts, which are provisioned from
// /admin/users (Phase 7) instead — see docs/schema-reconciliation.md
// note added alongside this file for the reasoning.
export const registerSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required"),
    lastName: z.string().trim().min(1, "Last name is required"),
    email: z.string().trim().toLowerCase().email("Enter a valid email address"),
    // BR-006: unique student number
    studentNumber: z.string().trim().min(1, "Student number is required"),
    // BR-008: student belongs to exactly one college (Office._id where type=college)
    collegeId: z.string().trim().min(1, "Select your college"),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
