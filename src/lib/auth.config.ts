/**
 * Edge-safe slice of the Auth.js config.
 *
 * Next.js middleware runs on the Edge runtime, which can't load mongoose
 * or bcryptjs (both are Node-only). Auth.js's recommended pattern for this
 * is to split the config: this file holds everything middleware needs
 * (session shape, callbacks that only read/reshape an already-verified
 * JWT, redirect pages) and has zero Node-only imports; src/lib/auth.ts
 * extends it with the Credentials provider, which does need the database
 * and does run in the Node runtime (Route Handlers, Server Actions).
 *
 * `middleware.ts` imports only from here. `src/lib/auth.ts` imports this
 * file and adds providers on top — never the other way around.
 */

import type { NextAuthConfig } from "next-auth";
import { env } from "./env";
import type { UserRole } from "./constants";

// Module augmentation so `token`/`session.user` are typed with the extra
// fields the jwt/session callbacks below attach, everywhere in the app.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      officeRef: string | null;
      collegeRef: string | null;
      // Not for display — only so requireSession() (Node runtime) can
      // detect a forceLogoutUser()/password-reset revocation without a
      // second round-trip to decode the raw JWT itself.
      tokenVersion: number;
    } & DefaultSessionUser;
  }

  interface User {
    role: UserRole;
    officeRef: string | null;
    collegeRef: string | null;
    tokenVersion: number;
  }
}

// Augmenting "next-auth/jwt" doesn't work in this next-auth version — that
// module file is just `export * from "@auth/core/jwt"`, not a module TS can
// attach an augmentation to directly. @auth/core/jwt is where JWT is
// actually declared, so that's the real augmentation target; next-auth/jwt
// re-exports the same (now-augmented) interface, so importing from either
// path still sees these fields.
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    officeRef: string | null;
    collegeRef: string | null;
    tokenVersion: number;
  }
}

// Minimal shape re-declared to avoid importing next-auth's internal
// DefaultUser type just for `name`/`email`/`image`.
interface DefaultSessionUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export const authConfig = {
  // BR-087: sessions expire after a configurable inactivity period. JWT
  // strategy (see docs/architecture.md section 5, "Why JWT, not database
  // sessions") — maxAge is the hard cap; there's no server-side idle timer
  // beyond the token's own expiry on a serverless/edge deployment.
  session: {
    strategy: "jwt",
    maxAge: env.AUTH_SESSION_MAX_AGE_MINUTES * 60,
  },

  pages: {
    signIn: "/login",
  },

  // No providers here on purpose — Credentials (and its DB-touching
  // authorize()) is added in src/lib/auth.ts only. `providers: []`
  // satisfies NextAuthConfig's type for the pieces (middleware) that only
  // need session/jwt callbacks and never call signIn().
  providers: [],

  callbacks: {
    // Runs at sign-in (when `user` is present, from Credentials'
    // authorize()) and on every subsequent request that decodes the JWT
    // (including inside middleware, at the Edge — `user` is undefined
    // then, so this branch is skipped and the existing token passes
    // through unchanged, no DB access needed).
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.officeRef = user.officeRef;
        token.collegeRef = user.collegeRef;
        token.tokenVersion = user.tokenVersion;
      }
      return token;
    },

    // Reshapes the JWT into what `session.user` exposes to Server
    // Components, Route Handlers, and the client. Also edge-safe: pure
    // field copying, no DB access.
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.officeRef = token.officeRef;
      session.user.collegeRef = token.collegeRef;
      session.user.tokenVersion = token.tokenVersion;
      return session;
    },
  },
} satisfies NextAuthConfig;
