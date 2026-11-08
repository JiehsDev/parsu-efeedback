import { z } from "zod";
import { parsuStudentEmailSchema } from "./register.schema";

export const verifyStudentEmailSchema = z.object({
  email: parsuStudentEmailSchema,
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your email."),
});

export const resendStudentEmailVerificationSchema = z.object({
  email: parsuStudentEmailSchema,
});
