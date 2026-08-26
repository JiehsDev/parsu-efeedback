// src/app/api/complaints/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Complaint } from "@/models/Complaint";
import { Category } from "@/models/Category";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { Assignment } from "@/models/Assignment";
import { createComplaintSchema } from "@/features/complaints/schemas/complaint.schema";
import { generateTicketNumber } from "@/features/complaints/services/ticket-number.service";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";
import type { PipelineStage } from "mongoose";
import { resolveSlaRule, computeSlaDates } from "@/features/sla/services/sla.service";
import { notifyComplaintSubmitted } from "@/features/notifications/services/notification.service";
import {
  resolveRoutingOffice,
  RoutingError,
} from "@/features/routing-engine/services/routing.service";
import { User } from "@/models/User";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "student") {
    return NextResponse.json({ error: "Only students can file complaints" }, { status: 403 });
  }

  await connectToDatabase();

  const body = await req.json();
  const parsed = createComplaintSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const category = await Category.findById(parsed.data.categoryRef);
  if (!category || !category.isActive) {
    return NextResponse.json({ error: "Invalid or inactive category" }, { status: 400 });
  }

  const student = await User.findById(session.user.id).lean();

  // --- Resolve routing office (may throw RoutingError) ---
  let resolvedOfficeRef: string;
  try {
    const result = await resolveRoutingOffice({
      categoryId: category._id.toString(),
      studentCollegeRef: student ? String((student as any).collegeRef ?? "") || null : null,
      priority: category.defaultPriority,
    });
    resolvedOfficeRef = result.officeRef;
  } catch (error) {
    if (error instanceof RoutingError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 422 });
    }
    throw error;
  }

  // --- Resolve SLA rule (no throw — just returns null if missing) ---
  const slaRule = await resolveSlaRule({
    categoryId: category._id.toString(),
    priority: category.defaultPriority,
  });

  if (!slaRule) {
    return NextResponse.json(
      {
        error: "No SLA configuration exists for this category/priority. Contact an administrator.",
        code: "NO_SLA_RULE",
      },
      { status: 422 },
    );
  }

  // --- Only now, after every validation has passed, generate the ticket
  // number and create the complaint — exactly once ---
  const ticketNumber = await generateTicketNumber();
  const routedAt = new Date();
  const { slaResponseDueAt, slaResolutionDueAt } = computeSlaDates(routedAt, slaRule as any);

  const complaint = await Complaint.create({
    ticketNumber,
    studentRef: session.user.id,
    categoryRef: category._id,
    title: parsed.data.title,
    description: parsed.data.description,
    priority: category.defaultPriority,
    status: "submitted",
    assignedOfficeRef: resolvedOfficeRef,
    slaResponseDueAt,
    slaResolutionDueAt,
  });

  await ComplaintTimeline.create({
    complaintRef: complaint._id,
    eventType: "submitted",
    actorRef: session.user.id,
    toValue: "submitted",
    message: "Complaint submitted by student",
  });

  // BR-050: the very first assignment record — a system action (no human
  // assigner) created by automatic routing, not yet claimed by a specific
  // staff member (assignedToRef stays null until someone self-assigns or
  // is assigned via /api/complaints/[id]/assign).
  await Assignment.create({
    complaintRef: complaint._id,
    assignedByRef: null,
    assignedToRef: null,
    sourceOfficeRef: null,
    destinationOfficeRef: resolvedOfficeRef,
  });

  await writeAuditLog({
    actorId: session.user.id,
    action: "complaint.create",
    entityType: "Complaint",
    entityId: complaint._id,
    afterState: complaint.toObject(),
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  await notifyComplaintSubmitted({
    studentId: session.user.id,
    ticketNumber: complaint.ticketNumber,
    complaintId: complaint._id.toString(),
  });

  return NextResponse.json({ complaint }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(100, Number(searchParams.get("limit") ?? 20));
  const status = searchParams.get("status");

  const filter: Record<string, unknown> = { isArchived: false };
  const { role, id, officeRef, collegeRef } = session.user;

  if (role === "student") {
    filter.studentRef = id;
  } else if (role === "office_staff") {
    filter.assignedOfficeRef = officeRef;
  } else if (role === "college_dean") {
    // handled via aggregation below
  }

  if (status) filter.status = status;

  let complaints: any[];
  let total: number;

  if (role === "college_dean") {
    const pipeline: PipelineStage[] = [
      {
        $lookup: {
          from: "users",
          localField: "studentRef",
          foreignField: "_id",
          as: "student",
        },
      },
      { $unwind: "$student" },
      {
        $lookup: {
          from: "offices",
          localField: "student.collegeRef",
          foreignField: "_id",
          as: "college",
        },
      },
      { $unwind: { path: "$college", preserveNullAndEmptyArrays: true } },
      {
        $match: {
          "student.collegeRef": collegeRef,
          isArchived: false,
          ...(status ? { status } : {}),
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ];
    complaints = await Complaint.aggregate(pipeline);
    total = complaints.length;
  } else {
    [complaints, total] = await Promise.all([
      Complaint.find(filter)
        .populate({
          path: "studentRef",
          select: "firstName lastName employeeOrStudentId collegeRef",
          populate: { path: "collegeRef", select: "name" },
        })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Complaint.countDocuments(filter),
    ]);
  }

  return NextResponse.json({ complaints, total, page, limit });
}
