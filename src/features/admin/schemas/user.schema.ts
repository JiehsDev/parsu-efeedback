// src/features/admin/schemas/user.schema.ts
import { z } from "zod";
import { USER_ROLES } from "@/lib/constants";

export const createUserSchema = z
  .object({
    employeeOrStudentId: z.string().trim().min(1),
    firstName: z.string().trim().min(1),
    lastName: z.string().trim().min(1),
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(8),
    role: z.enum(USER_ROLES),
    officeRef: z.string().nullable().optional(),
    collegeRef: z.string().nullable().optional(),
    isActive: z.boolean().optional().default(true),
  })
  .superRefine((data, ctx) => {
    // BR-009: office_staff need officeRef
    if (data.role === "office_staff" && !data.officeRef) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "officeRef is required for staff roles",
        path: ["officeRef"],
      });
    }
    // BR-008/015: a student is always scoped to exactly one college.
    if (data.role === "student" && !data.collegeRef) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "collegeRef is required for this role",
        path: ["collegeRef"],
      });
    }
    // administrator/vpaa/vpaf/osas are not tied to a single office/college
    // — vpaa/vpaf/osas operate at the office-category/student scope
    // instead (see src/lib/admin-scope.ts), not a single Office document.
  });

export const updateUserSchema = z.object({
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  role: z.enum(USER_ROLES).optional(),
  officeRef: z.string().nullable().optional(),
  collegeRef: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
  // Bumps tokenVersion without touching the password — for invalidating
  // every JWT already issued to this user (e.g. a lost device) when there's
  // no reason to also force a password change.
  forceLogout: z.boolean().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
