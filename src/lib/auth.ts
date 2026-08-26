/**
 * Full Auth.js configuration (Node runtime only).
 *
 * Extends the edge-safe `authConfig` (src/lib/auth.config.ts) with the
 * Credentials provider, whose authorize() needs mongoose + bcrypt and
 * therefore cannot run on the Edge. Import from *this* file in Route
 * Handlers, Server Actions, and Server Components; import from
 * auth.config.ts only in middleware.ts.
 *
 * See docs/architecture.md section 5 (Authentication Flow) for the
 * step-by-step this implements.
 */

import NextAuth, { CredentialsSignin, type Session } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { loginSchema } from "@/features/auth/schemas/login.schema";
import {
  authenticateUser,
  AccountInactiveError,
  AccountLockedError,
  InvalidCredentialsError,
} from "@/features/auth/services/auth.service";
import { loginRateLimit, checkRateLimit, getRequestIp } from "@/lib/rate-limit";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";

// Distinct error codes surfaced to the client via the `error` field
// returned from next-auth's signIn({ redirect: false }) — the login page
// maps these to specific copy instead of one generic "invalid" message.
class InvalidCredentialsSignin extends CredentialsSignin {
  override code = "invalid_credentials";
}
class AccountLockedSignin extends CredentialsSignin {
  override code = "account_locked";
}
class AccountInactiveSignin extends CredentialsSignin {
  override code = "account_inactive";
}
class RateLimitedSignin extends CredentialsSignin {
  override code = "rate_limited";
}

const { handlers, auth: baseAuth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials, request) {
        // architecture.md section 5, step 2d: rate-limit repeated failures
        // per IP, ahead of even looking at the credentials — this guards
        // distributed attempts across many accounts, complementing
        // BR-013's per-account lockout inside authenticateUser().
        const ip = getRequestIp(request.headers);
        const { success } = await checkRateLimit(loginRateLimit, ip);
        if (!success) {
          throw new RateLimitedSignin();
        }

        // BR-*: re-validate shape here too — never trust the provider's
        // loose `Record<string, unknown>` credentials type, even though
        // the login form already runs the same schema client-side.
        const parsed = loginSchema.safeParse(rawCredentials);
        if (!parsed.success) {
          throw new InvalidCredentialsSignin();
        }

        try {
          const user = await authenticateUser(parsed.data.email, parsed.data.password);

          return {
            id: user.id,
            email: user.email,
            name: `${user.firstName} ${user.lastName}`,
            role: user.role,
            officeRef: user.officeRef,
            collegeRef: user.collegeRef,
            tokenVersion: user.tokenVersion,
          };
        } catch (error) {
          if (error instanceof AccountLockedError) throw new AccountLockedSignin();
          if (error instanceof AccountInactiveError) throw new AccountInactiveSignin();
          if (error instanceof InvalidCredentialsError) {
            throw new InvalidCredentialsSignin();
          }
          throw error;
        }
      },
    }),
  ],
});

// middleware.ts (Edge runtime, src/proxy.ts) trusts the JWT's claims as of
// when it was issued and never touches the database — it can't see a
// later forceLogoutUser() bump or a since-deactivated account (BR-005).
// This wraps every Node-runtime `auth()` call (every Route Handler, Server
// Action, and Server Component imports `auth` from here, never straight
// from next-auth) with the one DB round-trip that actually makes those
// revocations take effect immediately instead of only at the JWT's
// natural expiry. Every existing call site's `if (!session?.user)` check
// already treats `null` as "not signed in", so this needed no call-site
// changes beyond the few pages that previously assumed auth() could never
// return null for an already-middleware-gated route (see git history).
//
// Only the zero-argument "get the current session" overload is supported
// here — the only one anything in this codebase actually calls (Route
// Handlers and Server Components, never middleware's request-wrapping
// form) — since `baseAuth`'s overloaded type can't be threaded through
// generically without TS picking the wrong overload.
export async function auth(): Promise<Session | null> {
  const session = await baseAuth();
  if (!session?.user) return session;

  await connectToDatabase();
  const user = await User.findById(session.user.id).select("isActive tokenVersion").lean();
  if (!user || !user.isActive || user.tokenVersion !== session.user.tokenVersion) {
    return null;
  }

  return session;
}

export { handlers, signIn, signOut };
