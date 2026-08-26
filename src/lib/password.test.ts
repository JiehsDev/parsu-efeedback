// src/lib/password.test.ts
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("lib/password (10-round hasher) — BR-004/086", () => {
  it("BR-004/086: hash is never equal to the plaintext password", async () => {
    const hash = await hashPassword("TestPass123!");
    expect(hash).not.toBe("TestPass123!");
    expect(hash.length).toBeGreaterThan(0);
  });

  it("BR-004/086: verifyPassword returns true for the correct password", async () => {
    const hash = await hashPassword("TestPass123!");
    await expect(verifyPassword("TestPass123!", hash)).resolves.toBe(true);
  });

  it("BR-004/086: verifyPassword returns false for an incorrect password", async () => {
    const hash = await hashPassword("TestPass123!");
    await expect(verifyPassword("WrongPass456!", hash)).resolves.toBe(false);
  });

  it("BR-004/086: hashing the same password twice produces different hashes (salted)", async () => {
    const hashA = await hashPassword("TestPass123!");
    const hashB = await hashPassword("TestPass123!");
    expect(hashA).not.toBe(hashB);
  });
});
