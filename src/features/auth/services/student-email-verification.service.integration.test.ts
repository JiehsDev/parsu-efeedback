import { createHmac } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { connectTestDb, disconnectTestDb, clearTestDb } from "@/test/setup-db";
import { createTestCollege } from "@/test/fixtures";
import { StudentEmailVerification } from "@/models/StudentEmailVerification";
import { User } from "@/models/User";

const emailMocks = vi.hoisted(() => ({ send: vi.fn() }));
const envMocks = vi.hoisted(() => ({ authSecret: "test-student-verification-secret" }));

vi.mock("@/lib/env", () => ({ env: { AUTH_SECRET: envMocks.authSecret } }));
vi.mock("@/features/notifications/services/email.service", () => ({
  sendStudentEmailVerificationEmail: emailMocks.send,
}));

import {
  InvalidStudentEmailCodeError,
  isStudentEmailVerificationInCooldown,
  resendStudentEmailVerificationCode,
  sendStudentEmailVerificationCode,
  VerificationResendCooldownError,
  verifyStudentEmailCode,
} from "./student-email-verification.service";

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(async () => {
  await clearTestDb();
  emailMocks.send.mockReset();
  emailMocks.send.mockResolvedValue(undefined);
});

async function createUnverifiedStudent(email = "student@parsu.edu.ph") {
  const college = await createTestCollege();
  return User.create({
    employeeOrStudentId: `SN-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    firstName: "Test",
    lastName: "Student",
    email,
    passwordHash: "not-used-by-this-test",
    role: "student",
    collegeRef: college._id,
    isActive: true,
    emailVerified: false,
  });
}

function codeHash(userId: string, code: string) {
  return createHmac("sha256", envMocks.authSecret).update(`${userId}:${code}`).digest("hex");
}

describe("student email verification", () => {
  it("stores only a keyed code hash, sends the code, and verifies once", async () => {
    const user = await createUnverifiedStudent();
    await sendStudentEmailVerificationCode(String(user._id));

    const sentCode = emailMocks.send.mock.calls[0]![0].code as string;
    const record = await StudentEmailVerification.findOne({ userRef: user._id }).lean();
    expect(sentCode).toMatch(/^\d{6}$/);
    expect(record!.codeHash).toBe(codeHash(String(user._id), sentCode));
    expect(record!.codeHash).not.toBe(sentCode);

    await verifyStudentEmailCode(user.email, sentCode);
    expect((await User.findById(user._id))!.emailVerified).toBe(true);
    expect((await StudentEmailVerification.findById(record!._id))!.usedAt).not.toBeNull();
    await expect(verifyStudentEmailCode(user.email, sentCode)).rejects.toBeInstanceOf(
      InvalidStudentEmailCodeError,
    );
  });

  it("expires the code after five incorrect attempts", async () => {
    const user = await createUnverifiedStudent();
    await sendStudentEmailVerificationCode(String(user._id));
    for (let attempt = 0; attempt < 5; attempt++) {
      await expect(verifyStudentEmailCode(user.email, "000000")).rejects.toBeInstanceOf(
        InvalidStudentEmailCodeError,
      );
    }

    const record = await StudentEmailVerification.findOne({ userRef: user._id }).lean();
    expect(record!.attempts).toBe(5);
    expect(record!.usedAt).not.toBeNull();
    await expect(
      verifyStudentEmailCode(user.email, emailMocks.send.mock.calls[0]![0].code),
    ).rejects.toBeInstanceOf(InvalidStudentEmailCodeError);
  });

  it("rejects expired verification codes", async () => {
    const user = await createUnverifiedStudent();
    await sendStudentEmailVerificationCode(String(user._id));
    const record = await StudentEmailVerification.findOne({ userRef: user._id });
    const code = emailMocks.send.mock.calls[0]![0].code as string;
    record!.expiresAt = new Date(Date.now() - 1);
    await record!.save();

    await expect(verifyStudentEmailCode(user.email, code)).rejects.toBeInstanceOf(
      InvalidStudentEmailCodeError,
    );
  });

  it("applies the resend cooldown and gives no account-existence signal", async () => {
    const user = await createUnverifiedStudent();
    await sendStudentEmailVerificationCode(String(user._id));
    await expect(isStudentEmailVerificationInCooldown(user.email)).resolves.toBe(true);
    await expect(
      isStudentEmailVerificationInCooldown("missing@parsu.edu.ph"),
    ).resolves.toBe(false);
    await expect(resendStudentEmailVerificationCode(user.email)).rejects.toBeInstanceOf(
      VerificationResendCooldownError,
    );
    await expect(
      resendStudentEmailVerificationCode("missing@parsu.edu.ph"),
    ).resolves.toBeUndefined();
    expect(emailMocks.send).toHaveBeenCalledOnce();
  });

  it("invalidates the code if the email provider fails", async () => {
    const user = await createUnverifiedStudent();
    emailMocks.send.mockRejectedValueOnce(new Error("provider unavailable"));
    await expect(sendStudentEmailVerificationCode(String(user._id))).rejects.toThrow(
      "provider unavailable",
    );

    const record = await StudentEmailVerification.findOne({ userRef: user._id }).lean();
    expect(record!.usedAt).not.toBeNull();
  });
});
