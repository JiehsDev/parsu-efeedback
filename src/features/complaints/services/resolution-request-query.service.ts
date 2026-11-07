import { Office } from "@/models/Office";
import { ResolutionRequest } from "@/models/ResolutionRequest";

interface ResolutionRequestHead {
  id: string;
  role: string;
  officeRef?: string | null;
}

export function resolutionRequestOfficeFilter(user: ResolutionRequestHead) {
  if (user.role === "osas") return { code: "OSAS" };
  if (user.role === "vpaa") return { code: "OVPAA" };
  if (user.role === "vpaf") return { code: "OVPAF" };
  if (user.role === "office_staff" && user.officeRef) return { _id: user.officeRef };
  return null;
}

export async function isResolutionRequestHead(user: ResolutionRequestHead): Promise<boolean> {
  const officeFilter = resolutionRequestOfficeFilter(user);
  if (!officeFilter) return false;
  return Boolean(await Office.exists({ ...officeFilter, headUserRef: user.id, isActive: true }));
}

export async function listPendingResolutionRequestsForHead(user: ResolutionRequestHead) {
  const officeFilter = resolutionRequestOfficeFilter(user);
  if (!officeFilter) return [];
  const offices = await Office.find({
    ...officeFilter,
    headUserRef: user.id,
    isActive: true,
  })
    .select("_id")
    .lean();
  if (!offices.length) return [];

  return ResolutionRequest.find({
    status: "pending",
    officeRef: { $in: offices.map((office) => office._id) },
  })
    .sort({ createdAt: -1 })
    .populate("complaintRef", "ticketNumber title status")
    .populate("requestedByRef", "firstName lastName")
    .lean();
}
