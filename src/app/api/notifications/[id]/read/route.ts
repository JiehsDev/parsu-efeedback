// src/app/api/notifications/[id]/read/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Notification } from "@/models/Notification";

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();
  const { id } = await params;

  const notification = await Notification.findById(id);
  if (!notification) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Users can only mark their own notifications as read
  if (String(notification.userRef) !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  notification.isRead = true;
  await notification.save();

  return NextResponse.json({ notification });
}
