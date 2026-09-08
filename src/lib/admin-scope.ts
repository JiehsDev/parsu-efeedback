// src/lib/admin-scope.ts
//
// Data-level scoping for the three sub-admin roles (vpaa/vpaf/osas), which
// all share the same /admin/** pages/routes as administrator but must only
// ever see/manage a slice of Offices/Users/Complaints — see docs/superpowers/
// specs/2026-09-07-role-restructuring-and-office-classification-design.md
// section 4. administrator itself is unrestricted (`kind: "all"`).
//
// This is the generalized, extracted form of the "pre-resolve complaint IDs
// via a join, then build a flat $match" pattern that used to be duplicated
// between the dean dashboard and /api/analytics/trends.
import type { UserRole, OfficeType } from "@/lib/constants";
import { Office } from "@/models/Office";

export type AdminScope =
  | { kind: "all" }
  | { kind: "college_office" }
  | { kind: "university_office" }
  | { kind: "student" };

export function getAdminScope(role: UserRole): AdminScope {
  switch (role) {
    case "vpaa":
      return { kind: "college_office" };
    case "vpaf":
      return { kind: "university_office" };
    case "osas":
      return { kind: "student" };
    default:
      return { kind: "all" };
  }
}

/** True for the three roles that get a slice of /admin/** rather than all of it. */
export function isScopedAdminRole(role: UserRole): role is "vpaa" | "vpaf" | "osas" {
  return role === "vpaa" || role === "vpaf" || role === "osas";
}

function officeTypeForScope(scope: AdminScope): OfficeType | null {
  return scope.kind === "college_office" || scope.kind === "university_office" ? scope.kind : null;
}

/** Mongo filter for the Office collection under this scope. osas gets no Offices access at all — callers must check that separately. */
export function officeFilterForScope(scope: AdminScope): Record<string, unknown> {
  const type = officeTypeForScope(scope);
  return type ? { type } : {};
}

/** Ids of every office in this scope's category, or null when the scope isn't office-category-bound (administrator, or osas — which has no office access). */
export async function officeIdsForScope(scope: AdminScope): Promise<string[] | null> {
  const type = officeTypeForScope(scope);
  if (!type) return null;
  const offices = await Office.find({ type }).select("_id").lean();
  return offices.map((o) => String(o._id));
}

/** Mongo filter for the User collection under this scope: vpaa/vpaf see staff in their office category, osas sees students, administrator sees everyone. */
export async function userFilterForScope(scope: AdminScope): Promise<Record<string, unknown>> {
  if (scope.kind === "student") return { role: "student" };
  const officeIds = await officeIdsForScope(scope);
  return officeIds ? { officeRef: { $in: officeIds } } : {};
}

/** Mongo filter for the Complaint collection under this scope: vpaa/vpaf see complaints assigned to their office category; osas/administrator see every complaint (osas's view is framed by student attributes, not office). */
export async function complaintFilterForScope(scope: AdminScope): Promise<Record<string, unknown>> {
  const officeIds = await officeIdsForScope(scope);
  return officeIds ? { assignedOfficeRef: { $in: officeIds } } : {};
}

/**
 * QA-style read access, folded into vpaa/vpaf/osas rather than kept as a
 * separate role: vpaa/vpaf may read (not mutate) any complaint sitting in
 * their office category — same "full detail, notes, attachments" access
 * qa_office/administrator get — and osas reads every complaint (its scope
 * spans both office categories, framed by student attributes). Used by the
 * shared /api/complaints/[id]/** routes (also hit by the admin complaint
 * detail page's NotesSection/AttachmentGallery), not just /admin/**.
 */
export async function isComplaintInAdminScope(
  scope: AdminScope,
  complaint: { assignedOfficeRef?: unknown },
): Promise<boolean> {
  if (scope.kind === "all" || scope.kind === "student") return true;
  if (!complaint.assignedOfficeRef) return false;
  const office = await Office.findById(complaint.assignedOfficeRef).select("type").lean();
  return (office as any)?.type === scope.kind;
}

/**
 * Standalone student Feedback (BR-099, distinct from a complaint's
 * satisfaction rating) carries no office/college link at all — it's just
 * studentRef/category/message. So unlike Complaints/Users, there's no
 * college-office-vs-university-office slice of it to hand vpaa/vpaf: it's
 * entirely a "student" concern, i.e. osas's domain, the same way Users with
 * role=student are only ever in osas's scope and never vpaa/vpaf's.
 */
export function canAccessFeedback(scope: AdminScope): boolean {
  return scope.kind === "all" || scope.kind === "student";
}
