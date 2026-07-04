// Authentication service — the only place credential verification logic
// lives. Consumed by the Credentials provider's authorize() in
// src/lib/auth.ts (Phase 6). No route/session concerns here, only:
//   BR-003  unique email lookup
//   BR-005  account must be active to authenticate
//   BR-012  update lastLoginAt on every successful authentication
//   BR-013  failed-attempt counter + temporary lockout

import { connectToDatabase } from "@/lib/db";
import { env } from "@/lib/env";
import { User } from "@/models/User";
import { verifyPassword } from "./password.service";

export class AccountInactiveError extends Error {
  constructor() {
    super("This account has been deactivated. Contact your administrator.");
    this.name = "AccountInactiveError";
  }
}

export class AccountLockedError extends Error {
  constructor(public readonly lockedUntil: Date) {
    super(
      `Too many failed login attempts. Try again after ${lockedUntil.toISOString()}.`,
    );
    this.name = "AccountLockedError";
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid email or password.");
    this.name = "InvalidCredentialsError";
  }
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  officeRef: string | null;
  collegeRef: string | null;
  tokenVersion: number;
}

/**
 * Verifies email + password against the users collection, enforcing
 * BR-005 (active accounts only) and BR-013 (lockout after repeated
 * failures). Throws a typed error on any failure so the Credentials
 * provider can map it to a specific sign-in error code; never returns a
 * partial/ambiguous result.
 */
export async function authenticateUser(
  email: string,
  password: string,
): Promise<AuthenticatedUser> {
  await connectToDatabase();

  const user = await User.findOne({ email: email.toLowerCase().trim() });

  // Same generic error for "no such user" and "wrong password" — never
  // reveal which one it was (standard practice, also keeps BR-013's
  // lockout counter meaningful only for accounts that actually exist).
  if (!user) {
    throw new InvalidCredentialsError();
  }

  // BR-013: locked accounts are rejected outright, without attempting a
  // password comparison and without incrementing the counter further.
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    throw new AccountLockedError(user.lockedUntil);
  }

  // BR-005: inactive accounts (deactivated by an admin, BR-011) may never
  // authenticate, regardless of password correctness.
  if (!user.isActive) {
    throw new AccountInactiveError();
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);

  if (!passwordMatches) {
    user.failedLoginAttempts += 1;

    if (user.failedLoginAttempts >= env.AUTH_MAX_FAILED_LOGIN_ATTEMPTS) {
      user.lockedUntil = new Date(
        Date.now() + env.AUTH_LOCKOUT_DURATION_MINUTES * 60_000,
      );
      user.failedLoginAttempts = 0; // window resets once locked
    }

    await user.save();
    throw new InvalidCredentialsError();
  }

  // BR-012: update lastLoginAt on every successful authentication, and
  // clear any stale failure bookkeeping now that the account has proven
  // ownership.
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  user.lastLoginAt = new Date();
  await user.save();

  return {
    id: user._id.toString(),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    officeRef: user.officeRef ? user.officeRef.toString() : null,
    collegeRef: user.collegeRef ? user.collegeRef.toString() : null,
    tokenVersion: user.tokenVersion,
  };
}

/**
 * Force-invalidates every JWT already issued to a user by bumping
 * tokenVersion — the mechanism docs/architecture.md section 5 calls out
 * for "admins can force-logout a compromised account." Not wired to a UI
 * yet (that's an admin-users feature, Phase 7); exposed here so that
 * feature can call straight into it without duplicating the increment
 * logic.
 */
export async function forceLogoutUser(userId: string): Promise<void> {
  await connectToDatabase();
  await User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
}
