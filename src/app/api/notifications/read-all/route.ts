// src/app/api/notifications/read-all/route.ts
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Notification } from "@/models/Notification";

export async function PATCH() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();

  await Notification.updateMany({ userRef: session.user.id, isRead: false }, { isRead: true });

  return NextResponse.json({ success: true });
}
