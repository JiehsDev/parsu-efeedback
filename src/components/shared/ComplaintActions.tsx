import {
  canAssignComplaint,
  canProcessComplaint,
  canSuperviseComplaint,
  refId,
} from "@/lib/osas-operations";
import { resolveManualEscalationTarget } from "@/lib/manual-escalation";
import { AssignmentDialog } from "./AssignmentDialog";
import { StatusUpdateForm } from "@/components/staff/StatusUpdateForm";
import { HandlePersonallyButton } from "@/components/staff/HandlePersonallyButton";
import { ReleaseAssignmentButton } from "@/components/staff/ReleaseAssignmentButton";
import { ArchiveRequestButton } from "@/components/staff/ArchiveRequestButton";
import { ArchiveApprovalPanel } from "@/components/staff/ArchiveApprovalPanel";
import { InformationRequestPanel } from "@/components/staff/InformationRequestPanel";
import { ArchiveComplaintToggle } from "@/components/admin/ArchiveComplaintToggle";
import { ReopenComplaintButton } from "./ReopenComplaintButton";
import { ResolutionApprovalPanel } from "@/components/staff/ResolutionApprovalPanel";
import { isOfficeHead } from "@/lib/office-head";
export async function ComplaintActions({
  session,
  complaint: c,
  office,
  staff,
  requests,
  archives,
  resolutionRequests,
}: {
  session: any;
  complaint: any;
  office: any;
  staff: any;
  requests: any[];
  archives: any[];
  resolutionRequests: any[];
}) {
  const receiving = ["OVPAA", "OVPAF"].includes(office?.code);
  const head = await canSuperviseComplaint(session, c);
  const officeHead = await isOfficeHead(session.user.id, c.assignedOfficeRef);
  const canAssign = await canAssignComplaint(session, c);
  const mine = await canProcessComplaint(session, c);
  const admin = session.user.role === "administrator";
  const terminal = ["resolved", "closed", "withdrawn"].includes(c.status);
  const id = refId(c._id);
  const pending = archives.find((r) => r.status === "pending");
  const pendingResolution = resolutionRequests.find((r) => r.status === "pending");
  const latestResolutionRequest = resolutionRequests[0];
  const target =
    !admin && !receiving && mine && !head && !terminal && !c.isArchived
      ? await resolveManualEscalationTarget(c, session.user.role)
      : null;
  const assignmentProps = {
    complaintId: id,
    currentOfficeId: refId(c.assignedOfficeRef),
    currentOfficeName: office?.name ?? "OSAS",
    currentStaffId: c.assignedStaffRef ? refId(c.assignedStaffRef) : null,
    currentStaffName: staff ? `${staff.firstName} ${staff.lastName}` : null,
    receivingOffice: receiving,
  };
  if (!admin && !head && !mine && !canAssign) return null;
  return (
    <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <h2 className="text-sm font-semibold">
        {admin ? "Archive administration" : "Complaint actions"}
      </h2>
      {c.isArchived ? (
        <>
          <p className="text-sm text-[var(--muted-foreground)]">
            Archived complaints are read-only.
          </p>
          {(head || admin) && (
            <ArchiveComplaintToggle
              complaintId={id}
              ticketNumber={c.ticketNumber}
              isArchived
              mode={admin ? "admin" : "head"}
            />
          )}
        </>
      ) : (
        <>
          {latestResolutionRequest && (
            <ResolutionApprovalPanel
              request={latestResolutionRequest}
              canReview={officeHead}
            />
          )}
          {canAssign && !terminal && (
            <>
              <AssignmentDialog
                {...assignmentProps}
                label={c.assignedStaffRef ? "Change Assignee" : "Assign Staff"}
                action={c.assignedStaffRef ? "reassign" : "assign"}
              />
              {refId(c.assignedStaffRef) !== session.user.id && (
                <HandlePersonallyButton
                  complaintId={id}
                  headId={session.user.id}
                  needsReason={Boolean(c.assignedStaffRef)}
                />
              )}
            </>
          )}
          {!admin && mine && !terminal && (
            <>
              {!pendingResolution && (
                <StatusUpdateForm
                  complaintId={id}
                  currentStatus={c.status}
                  requiresResolutionApproval={!officeHead}
                />
              )}
              <InformationRequestPanel complaintId={id} status={c.status} requests={requests} />
              {!receiving && <ReleaseAssignmentButton complaintId={id} />}
              {!receiving && !head && !pending && <ArchiveRequestButton complaintId={id} />}
            </>
          )}
          {target && (
            <AssignmentDialog
              {...assignmentProps}
              label="Request OSAS Head Review"
              action="escalate"
            />
          )}
          {(head || admin) && (
            <>
              {pending && head ? (
                <ArchiveApprovalPanel request={pending} />
              ) : (
                <ArchiveComplaintToggle
                  complaintId={id}
                  ticketNumber={c.ticketNumber}
                  isArchived={false}
                  mode={admin ? "admin" : "head"}
                />
              )}{" "}
              {(c.status === "resolved" || (admin && c.status === "closed")) && (
                <ReopenComplaintButton complaintId={id} />
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
