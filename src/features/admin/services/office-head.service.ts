import { Office } from "@/models/Office";
import { User } from "@/models/User";
import { hashPassword } from "@/lib/password";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";

const HEAD_ELIGIBLE_ROLES = new Set(["office_staff", "administrator", "vpaa", "vpaf", "osas"]);

export async function validateOfficeHeadCandidate(officeId: string, userId: string) {
  const [office, user] = await Promise.all([
    Office.findById(officeId).lean(),
    User.findById(userId).select("-passwordHash").lean(),
  ]);

  if (!office) return { error: "Office not found", status: 404 as const };
  if (!user) return { error: "User not found", status: 404 as const };
  if (!(user as any).isActive) return { error: "Office head must be an active user", status: 400 as const };
  if ((user as any).role === "student") return { error: "Students cannot be office heads", status: 400 as const };
  if (!HEAD_ELIGIBLE_ROLES.has((user as any).role)) {
    return { error: "This role cannot be assigned as an office head", status: 400 as const };
  }
  if (String((user as any).officeRef ?? "") !== officeId) {
    return { error: "Office head must belong to this office", status: 400 as const };
  }

  return { office, user };
}

export async function assignOfficeHead(params: {
  officeId: string;
  userId: string;
  actorId: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const validation = await validateOfficeHeadCandidate(params.officeId, params.userId);
  if ("error" in validation) return validation;

  const before = validation.office as any;
  const action = before.headUserRef ? "OFFICE_HEAD_REPLACED" : "OFFICE_HEAD_ASSIGNED";
  const after = await Office.findByIdAndUpdate(
    params.officeId,
    { headUserRef: params.userId },
    { returnDocument: "after" },
  ).lean();

  await writeAuditLog({
    actorId: params.actorId,
    action,
    entityType: "Office",
    entityId: params.officeId,
    beforeState: { headUserRef: before.headUserRef ?? null },
    afterState: { headUserRef: params.userId },
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });

  return { office: after, action };
}

export async function removeOfficeHead(params: {
  officeId: string;
  actorId: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const before = await Office.findById(params.officeId).lean();
  if (!before) return { error: "Office not found", status: 404 as const };

  const after = await Office.findByIdAndUpdate(
    params.officeId,
    { headUserRef: null },
    { returnDocument: "after" },
  ).lean();

  await writeAuditLog({
    actorId: params.actorId,
    action: "OFFICE_HEAD_REMOVED",
    entityType: "Office",
    entityId: params.officeId,
    beforeState: { headUserRef: (before as any).headUserRef ?? null },
    afterState: { headUserRef: null },
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });

  return { office: after };
}

export async function createHeadAccountAndAssign(params: {
  officeId: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeOrStudentId: string;
  password: string;
  actorId: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const office = await Office.findById(params.officeId).lean();
  if (!office) return { error: "Office not found", status: 404 as const };

  const existing = await User.findOne({
    $or: [{ email: params.email }, { employeeOrStudentId: params.employeeOrStudentId }],
  }).lean();
  if (existing) return { error: "A user with this email or ID already exists", status: 409 as const };

  const passwordHash = await hashPassword(params.password);
  const user = await User.create({
    firstName: params.firstName,
    lastName: params.lastName,
    email: params.email,
    employeeOrStudentId: params.employeeOrStudentId,
    passwordHash,
    role: "office_staff",
    officeRef: params.officeId,
    collegeRef: null,
    isActive: true,
    tokenVersion: 1,
  });

  const assigned = await assignOfficeHead({
    officeId: params.officeId,
    userId: String(user._id),
    actorId: params.actorId,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });
  if ("error" in assigned) {
    await User.findByIdAndDelete(user._id);
    return assigned;
  }

  await writeAuditLog({
    actorId: params.actorId,
    action: "user.create",
    entityType: "User",
    entityId: user._id,
    afterState: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      employeeOrStudentId: user.employeeOrStudentId,
      role: user.role,
      officeRef: user.officeRef,
      isActive: user.isActive,
    },
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });

  const safeUser = user.toObject();
  delete (safeUser as any).passwordHash;
  return { office: assigned.office, user: safeUser };
}
