// BR-004 / BR-086: passwords are hashed before storage and never stored or
// compared in plaintext. Centralized here so every call site (register,
// login, reset-password, and any future admin-created-account flow in
// Phase 7) hashes/verifies the same way with the same cost factor.

import bcrypt from "bcryptjs";

// 12 rounds: comfortably above bcrypt's default (10) without being slow
// enough to matter on a serverless cold start.
const SALT_ROUNDS = 12;

export async function hashPassword(plainTextPassword: string): Promise<string> {
  return bcrypt.hash(plainTextPassword, SALT_ROUNDS);
}

export async function verifyPassword(
  plainTextPassword: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(plainTextPassword, passwordHash);
}
