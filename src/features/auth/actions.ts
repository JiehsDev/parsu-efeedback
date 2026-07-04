"use server";

import { headers } from "next/headers";
import { registerSchema } from "./schemas/register.schema";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./schemas/password-reset.schema";
import {
  registerStudent,
  EmailAlreadyRegisteredError,
  StudentNumberAlreadyRegisteredError,
  InvalidCollegeError,
} from "./services/register.service";
import {
  requestPasswordReset,
  resetPassword,
  InvalidOrExpiredTokenError,
} from "./services/password-reset.service";
import {
  registerRateLimit,
  passwordResetRateLimit,
  checkRateLimit,
  getRequestIp,
} from "@/lib/rate-limit";

export interface ActionResult {
  success: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
}

export async function registerAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const ip = getRequestIp(await headers());
  const { success: withinLimit } = await checkRateLimit(registerRateLimit, ip);
  if (!withinLimit) {
    return {
      success: false,
      message: "Too many registration attempts. Please try again later.",
    };
  }

  const parsed = registerSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    studentNumber: formData.get("studentNumber"),
    collegeId: formData.get("collegeId"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await registerStudent(parsed.data);
    return {
      success: true,
      message: "Account created. You can now sign in.",
    };
  } catch (error) {
    if (
      error instanceof EmailAlreadyRegisteredError ||
      error instanceof StudentNumberAlreadyRegisteredError ||
      error instanceof InvalidCollegeError
    ) {
      return { success: false, message: error.message };
    }
    throw error;
  }
}

export async function forgotPasswordAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const ip = getRequestIp(await headers());

  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return {
      success: false,
      message: "Enter a valid email address.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  // Rate-limit by IP+email so this can't be used to spam one inbox.
  const { success: withinLimit } = await checkRateLimit(
    passwordResetRateLimit,
    `${ip}:${parsed.data.email}`,
  );

  // Same message whether or not the email matched an account, and even
  // when rate-limited — never reveal account existence via a different
  // response shape/timing.
  const genericMessage =
    "If an account exists for that email, a password reset link has been sent.";

  if (!withinLimit) {
    return { success: true, message: genericMessage };
  }

  await requestPasswordReset(parsed.data.email, ip);
  return { success: true, message: genericMessage };
}

export async function resetPasswordAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await resetPassword(parsed.data.token, parsed.data.password);
    return {
      success: true,
      message: "Password updated. You can now sign in with your new password.",
    };
  } catch (error) {
    if (error instanceof InvalidOrExpiredTokenError) {
      return { success: false, message: error.message };
    }
    throw error;
  }
}
