// Defense-in-depth session helper for Route Handlers and Server Actions.
//
// middleware.ts (Edge runtime) can only trust the JWT's claims as of the
// moment it was issued — it never touches the database, so it can't see
// an admin's later forceLogoutUser() bump (tokenVersion) or a
// since-deactivated account (BR-005). This helper runs in the Node
// runtime, re-fetches the user, and is what every protected Route Handler
// should call instead of `auth()` directly, starting with the features
// built in Phase 7+.

import { connectToDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { User } from "@/models/User";
import type { UserRole } from "@/lib/constants";

export class UnauthenticatedError extends Error {
  constructor() {
    super("Not signed in.");
    this.name = "UnauthenticatedError";
  }
}

export class SessionRevokedError extends Error {
  constructor() {
    super("This session is no longer valid. Please sign in again.");
    this.name = "SessionRevokedError";
  }
}

export class ForbiddenRoleError extends Error {
  constructor() {
    super("You do not have permission to perform this action.");
    this.name = "ForbiddenRoleError";
  }
}

export interface VerifiedSession {
  userId: string;
  role: UserRole;
  officeRef: string | null;
  collegeRef: string | null;
}

/**
 * Re-verifies the current Auth.js session against the database:
 *   - a session must exist at all
 *   - the user must still be active (BR-005 — an admin may have
 *     deactivated it after the JWT was issued)
 *   - the JWT's tokenVersion must match the user's current tokenVersion
 *     (otherwise it was force-invalidated — forceLogoutUser / a
 *     completed password reset)
 *
 * Pass `allowedRoles` to also enforce a specific-role check in the same
 * call, mirroring architecture.md section 6 step 4 ("re-check role
 * explicitly — never rely on middleware alone").
 */
export async function requireSession(
  allowedRoles?: readonly UserRole[],
): Promise<VerifiedSession> {
  const session = await auth();
  if (!session?.user) {
    throw new UnauthenticatedError();
  }

  await connectToDatabase();
  const user = await User.findById(session.user.id).select(
    "isActive tokenVersion role officeRef collegeRef",
  );

  // Account deleted/deactivated, or the JWT's claims otherwise no longer
  // correspond to a live, current account.
  if (!user || !user.isActive) {
    throw new SessionRevokedError();
  }

  // The JWT was force-invalidated after being issued — an admin called
  // forceLogoutUser(), or the user completed a password reset (which also
  // bumps tokenVersion). Either way, this token must stop working
  // immediately rather than at its natural expiry.
  if (user.tokenVersion !== session.user.tokenVersion) {
    throw new SessionRevokedError();
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    throw new ForbiddenRoleError();
  }

  return {
    userId: user._id.toString(),
    role: user.role,
    officeRef: user.officeRef ? user.officeRef.toString() : null,
    collegeRef: user.collegeRef ? user.collegeRef.toString() : null,
  };
}
