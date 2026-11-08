import mongoose from "mongoose";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";

interface CorrectComplaintContentParams {
  complaintId: string;
  actorId: string;
  title: string;
  description: string;
  reason: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

type CorrectionResult =
  | { complaint: { _id: string; ticketNumber: string; title: string; description: string } }
  | { error: string; status: number };

export async function correctComplaintContent(
  params: CorrectComplaintContentParams,
): Promise<CorrectionResult> {
  await connectToDatabase();
  const session = await mongoose.startSession();
  let result: CorrectionResult = {
    error: "Complaint correction was not completed.",
    status: 500,
  };

  try {
    await session.withTransaction(async () => {
      const complaint = await Complaint.findById(params.complaintId).session(session);
      if (!complaint) {
        result = { error: "Not found", status: 404 };
        return;
      }
      if (complaint.isArchived) {
        result = {
          error: "Archived complaints must be restored before content can be corrected.",
          status: 409,
        };
        return;
      }
      if (complaint.title === params.title && complaint.description === params.description) {
        result = { error: "The correction does not change the complaint content.", status: 400 };
        return;
      }

      const beforeState = {
        title: complaint.title,
        description: complaint.description,
      };
      complaint.title = params.title;
      complaint.description = params.description;
      await complaint.save({ session });

      await ComplaintTimeline.create(
        [
          {
            complaintRef: complaint._id,
            eventType: "admin_content_corrected",
            actorRef: params.actorId,
            message: params.reason,
          },
        ],
        { session },
      );
      await writeAuditLog({
        actorId: params.actorId,
        action: "complaint.content_corrected",
        entityType: "Complaint",
        entityId: complaint._id,
        beforeState,
        afterState: {
          title: params.title,
          description: params.description,
          reason: params.reason,
        },
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        session,
      });

      result = {
        complaint: {
          _id: String(complaint._id),
          ticketNumber: complaint.ticketNumber,
          title: complaint.title,
          description: complaint.description,
        },
      };
    });
  } finally {
    await session.endSession();
  }

  return result;
}
