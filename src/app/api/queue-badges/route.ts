import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { QueueReadState } from "@/models/QueueReadState";
import { Complaint } from "@/models/Complaint";
import { Assignment } from "@/models/Assignment";
import { ArchiveRequest } from "@/models/ArchiveRequest";
import { ResolutionRequest } from "@/models/ResolutionRequest";
import { DismissalRequest } from "@/models/DismissalRequest";
import { ForwardingRequest } from "@/models/ForwardingRequest";
import { OfficeReturnRequest } from "@/models/OfficeReturnRequest";
import { Feedback } from "@/models/Feedback";
import { User } from "@/models/User";
import { Office } from "@/models/Office";
import { complaintFilterForScope, getAdminScope } from "@/lib/admin-scope";
import { staffComplaintFilter, isOsasHead, getStaffOffice } from "@/lib/osas-operations";
import {
  isResolutionRequestHead,
  resolutionRequestOfficeFilter,
} from "@/features/complaints/services/resolution-request-query.service";

const KEYS = [
  "complaints",
  "archived",
  "feedback",
  "users",
  "forwarding",
  "archive",
  "resolution",
  "dismissal",
  "return",
] as const;
type Key = (typeof KEYS)[number];

async function canView(user: any, key: Key) {
  const role = user.role;
  if (key === "complaints")
    return ["student", "office_staff", "administrator", "osas", "vpaa", "vpaf"].includes(role);
  if (key === "archived")
    return ["office_staff", "administrator", "osas", "vpaa", "vpaf"].includes(role);
  if (key === "feedback") return role === "administrator" || role === "osas";
  if (key === "users") return role === "administrator";
  if (key === "forwarding")
    return (
      role === "administrator" ||
      (await isOsasHead({ user })) ||
      ((role === "office_staff" || role === "osas") &&
        (await getStaffOffice({ user }))?.code === "OSAS")
    );
  if (key === "archive")
    return (
      role === "administrator" ||
      ((role === "office_staff" || role === "osas") && (await isOsasHead({ user })))
    );
  if (key === "resolution") return isResolutionRequestHead(user);
  if (key === "dismissal") return isResolutionRequestHead(user);
  if (key === "return") return isOsasHead({ user });
  return false;
}

function scopedKey(user: any, key: Key) {
  return `${user.role}:${user.officeRef ?? "none"}:${key}`;
}

async function countFor(user: any, key: Key, since: Date) {
  const role = user.role;
  if (key === "complaints") {
    if (role === "student")
      return Complaint.countDocuments({
        studentRef: user.id,
        isArchived: false,
        submittedAt: { $gt: since },
      });
    const filter =
      role === "office_staff"
        ? await staffComplaintFilter({ user })
        : await complaintFilterForScope(getAdminScope(role));
    if (role === "office_staff" || ["osas", "vpaa", "vpaf", "administrator"].includes(role)) {
      const [submitted, assignmentIds] = await Promise.all([
        Complaint.find({ ...filter, isArchived: false, submittedAt: { $gt: since } }).distinct(
          "_id",
        ),
        Assignment.find({
          createdAt: { $gt: since },
          actionType: {
            $in: ["forward", "return_to_osas", "office_reassignment"],
          },
          ...(role !== "administrator" && user.officeRef
            ? { destinationOfficeRef: user.officeRef }
            : {}),
        }).distinct("complaintRef"),
      ]);
      const ids = [...new Set([...submitted.map(String), ...assignmentIds.map(String)])];
      return Complaint.countDocuments({ ...filter, _id: { $in: ids }, isArchived: false });
    }
    return 0;
  }
  if (key === "archived") {
    const filter =
      role === "office_staff"
        ? await staffComplaintFilter({ user })
        : await complaintFilterForScope(getAdminScope(role));
    return Complaint.countDocuments({ ...filter, isArchived: true, archivedAt: { $gt: since } });
  }
  if (key === "feedback")
    return Feedback.countDocuments({ isArchived: false, createdAt: { $gt: since } });
  if (key === "users") return User.countDocuments({ createdAt: { $gt: since } });
  if (key === "forwarding") {
    if (
      role === "administrator" ||
      (await isOsasHead({ user })) ||
      ((role === "office_staff" || role === "osas") &&
        (await getStaffOffice({ user }))?.code === "OSAS")
    )
      return ForwardingRequest.countDocuments({
        requestedAt: { $gt: since },
        ...(role === "administrator" || (await isOsasHead({ user }))
          ? {}
          : { requestedByUserRef: user.id }),
      });
    return 0;
  }
  if (key === "archive") {
    const eligible =
      role === "administrator" ||
      (role === "office_staff" && (await isOsasHead({ user }))) ||
      (role === "osas" && (await isOsasHead({ user })));
    if (!eligible) return 0;
    const offices =
      role === "administrator"
        ? null
        : await Office.find({ headUserRef: user.id, isActive: true }).distinct("_id");
    return ArchiveRequest.countDocuments({
      status: "pending",
      createdAt: { $gt: since },
      ...(offices ? { officeRef: { $in: offices } } : {}),
    });
  }
  if (key === "resolution") {
    if (!(await isResolutionRequestHead(user))) return 0;
    const officeFilter = resolutionRequestOfficeFilter(user);
    const officeIds = officeFilter
      ? await Office.find({ ...officeFilter, headUserRef: user.id, isActive: true }).distinct("_id")
      : [];
    return officeIds.length
      ? ResolutionRequest.countDocuments({
          officeRef: { $in: officeIds },
          status: "pending",
          createdAt: { $gt: since },
        })
      : 0;
  }
  if (key === "dismissal") {
    if (!(await isResolutionRequestHead(user))) return 0;
    const officeFilter = resolutionRequestOfficeFilter(user);
    const offices = officeFilter
      ? await Office.find({ ...officeFilter, headUserRef: user.id, isActive: true }).distinct("_id")
      : [];
    return offices.length
      ? DismissalRequest.countDocuments({
          officeRef: { $in: offices },
          status: "pending",
          createdAt: { $gt: since },
        })
      : 0;
  }
  if (key === "return") {
    if (!(await isOsasHead({ user }))) return 0;
    const office = await Office.findOne({ code: "OSAS", headUserRef: user.id, isActive: true })
      .select("_id")
      .lean();
    return office
      ? OfficeReturnRequest.countDocuments({
          destinationOfficeRef: office._id,
          status: "pending",
          requestedAt: { $gt: since },
        })
      : 0;
  }
  return 0;
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectToDatabase();
  const states = await QueueReadState.find({ userRef: session.user.id }).lean();
  const stateByKey = new Map(states.map((state: any) => [state.listKey, state.lastCheckedAt]));
  const counts: Record<string, number> = {};
  const firstSeenAt = new Date();
  const visible = await Promise.all(
    KEYS.map(async (key) => ({ key, allowed: await canView(session.user, key) })),
  );
  const visibleKeys = visible.filter((entry) => entry.allowed).map((entry) => entry.key);
  const checkedAt = await Promise.all(
    visibleKeys.map(async (key) => {
      const listKey = scopedKey(session.user, key);
      let lastCheckedAt = stateByKey.get(listKey);
      if (!lastCheckedAt) {
        const state = await QueueReadState.findOneAndUpdate(
          { userRef: session.user.id, listKey },
          { $setOnInsert: { lastCheckedAt: firstSeenAt } },
          { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
        ).lean();
        lastCheckedAt = state!.lastCheckedAt;
      }
      return { key, lastCheckedAt };
    }),
  );
  const entries = await Promise.all(
    checkedAt.map(
      async ({ key, lastCheckedAt }) =>
        [key, await countFor(session.user, key, lastCheckedAt)] as const,
    ),
  );
  for (const [key, count] of entries) counts[key] = count;
  return NextResponse.json({ counts }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body: unknown = await req.json().catch(() => null);
  const requestedKey = body && typeof body === "object" && "key" in body ? body.key : null;
  if (typeof requestedKey !== "string" || !KEYS.includes(requestedKey as Key))
    return NextResponse.json({ error: "Invalid list key" }, { status: 400 });
  await connectToDatabase();
  const key = requestedKey as Key;
  // Validate the requested list is visible to this user before acknowledging it.
  if (!(await canView(session.user, key)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await QueueReadState.findOneAndUpdate(
    { userRef: session.user.id, listKey: scopedKey(session.user, key) },
    { $set: { lastCheckedAt: new Date() } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );
  return NextResponse.json({ ok: true });
}
