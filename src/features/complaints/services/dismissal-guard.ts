import { DismissalRequest } from "@/models/DismissalRequest";
import { Types } from "mongoose";

export async function hasPendingDismissal(complaintId: Types.ObjectId): Promise<boolean> {
  return Boolean(await DismissalRequest.exists({ complaintRef: complaintId, status: "pending" }));
}
