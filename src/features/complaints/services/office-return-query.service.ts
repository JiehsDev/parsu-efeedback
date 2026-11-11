import { Office } from "@/models/Office";
import { OfficeReturnRequest } from "@/models/OfficeReturnRequest";
import { isOsasHead } from "@/lib/osas-operations";

export async function listPendingOfficeReturnRequests(session: any) {
  if (!(await isOsasHead(session))) return [];
  const office = await Office.findOne({
    code: "OSAS",
    isActive: true,
    headUserRef: session.user.id,
  })
    .select("_id")
    .lean();
  if (!office) return [];

  return OfficeReturnRequest.find({ status: "pending", destinationOfficeRef: office._id })
    .sort({ requestedAt: 1 })
    .limit(100)
    .populate({
      path: "complaintRef",
      select: "ticketNumber title description status priority categoryRef",
      populate: { path: "categoryRef", select: "name" },
    })
    .populate("sourceOfficeRef", "name code")
    .populate("requestedByUserRef", "firstName lastName")
    .lean();
}

export async function listRecentOfficeReturnDecisions(session: any) {
  if (!(await isOsasHead(session))) return [];
  const office = await Office.findOne({
    code: "OSAS",
    isActive: true,
    headUserRef: session.user.id,
  })
    .select("_id")
    .lean();
  if (!office) return [];

  return OfficeReturnRequest.find({
    status: { $in: ["approved", "rejected"] },
    destinationOfficeRef: office._id,
  })
    .sort({ reviewedAt: -1 })
    .limit(100)
    .populate({
      path: "complaintRef",
      select: "ticketNumber title description status priority categoryRef",
      populate: { path: "categoryRef", select: "name" },
    })
    .populate("sourceOfficeRef", "name code")
    .populate("requestedByUserRef reviewedByUserRef", "firstName lastName")
    .lean();
}
