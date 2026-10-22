import { staffComplaintFilter } from "@/lib/osas-operations";
// src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Notification } from "@/models/Notification";
import { Complaint } from "@/models/Complaint";
import { complaintFilterForScope, getAdminScope, isScopedAdminRole } from "@/lib/admin-scope";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unreadOnly") === "true";
  const limit = Math.min(100, Number(searchParams.get("limit") ?? 20));

  const filter: Record<string, unknown> = { userRef: session.user.id };
  if (isScopedAdminRole(session.user.role) || session.user.role === "office_staff") {
    const complaints = await Complaint.find(
      await (session.user.role === "office_staff"
        ? staffComplaintFilter(session)
        : complaintFilterForScope(getAdminScope(session.user.role))),
    )
      .select("_id")
      .lean();
    filter.$or = [
      { relatedComplaintRef: null },
      { relatedComplaintRef: { $in: complaints.map((complaint) => complaint._id) } },
    ];
  }
  if (unreadOnly) filter.isRead = false;

  const [notifications, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).limit(limit).lean(),
    Notification.countDocuments({ ...filter, isRead: false }),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}
