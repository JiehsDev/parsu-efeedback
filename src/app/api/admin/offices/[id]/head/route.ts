import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { requireAdmin } from "@/lib/api-guards";
import {
  assignOfficeHead,
  createHeadAccountAndAssign,
  removeOfficeHead,
} from "@/features/admin/services/office-head.service";

const assignHeadSchema = z.object({
  headUserRef: z.string().min(1),
});

const createHeadSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  email: z.string().trim().toLowerCase().email(),
  employeeOrStudentId: z.string().trim().min(1),
  password: z.string().min(8),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  await connectToDatabase();

  const { id } = await params;
  const parsed = assignHeadSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await assignOfficeHead({
    officeId: id,
    userId: parsed.data.headUserRef,
    actorId: guard.session.user.id,
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ office: result.office });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  await connectToDatabase();

  const { id } = await params;
  const parsed = createHeadSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await createHeadAccountAndAssign({
    officeId: id,
    ...parsed.data,
    actorId: guard.session.user.id,
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ office: result.office, user: result.user }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  await connectToDatabase();

  const { id } = await params;
  const result = await removeOfficeHead({
    officeId: id,
    actorId: guard.session.user.id,
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ office: result.office });
}
