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

import NextAuth, { CredentialsSignin } from "next-auth";
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

// Distinct error codes surfaced to the client via the `error` field
// returned from next-auth's signIn({ redirect: false }) — the login page
// maps these to specific copy instead of one generic "invalid" message.
class InvalidCredentialsSignin extends CredentialsSignin {
  code = "invalid_credentials";
}
class AccountLockedSignin extends CredentialsSignin {
  code = "account_locked";
}
class AccountInactiveSignin extends CredentialsSignin {
  code = "account_inactive";
}
class RateLimitedSignin extends CredentialsSignin {
  code = "rate_limited";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
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
          const user = await authenticateUser(
            parsed.data.email,
            parsed.data.password,
          );

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
