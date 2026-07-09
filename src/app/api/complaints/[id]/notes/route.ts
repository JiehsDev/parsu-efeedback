// src/app/api/complaints/[id]/notes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Complaint } from "@/models/Complaint";
import { ComplaintNote } from "@/models/ComplaintNote";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { addNoteSchema } from "@/features/complaints/schemas/complaint.schema";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Notes are staff/dean/qa/admin only — never visible to or writable by students
  if (session.user.role === "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const { id } = await params;

  const body = await req.json();
  const parsed = addNoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const complaint = await Complaint.findById(id).lean();
  if (!complaint) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const note = await ComplaintNote.create({
    complaintRef: id,
    authorRef: session.user.id,
    body: parsed.data.body,
  });

  await ComplaintTimeline.create({
    complaintRef: id,
    eventType: "note_added",
    actorRef: session.user.id,
    message: "Internal note added",
  });

  return NextResponse.json({ note }, { status: 201 });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const { id } = await params;

  const notes = await ComplaintNote.find({ complaintRef: id }).sort({ createdAt: 1 }).lean();
  return NextResponse.json({ notes });
}
