import { roleLabel } from "@/lib/display-labels";

type Actor = {
  role?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  employeeOrStudentId?: string | null;
};

/** Keeps complainant identity out of staff-facing complaint activity. */
export function getActorDisplayName(actor: Actor | null | undefined, viewerRole = "handler") {
  if (!actor) return "System";
  if (actor.role === "student" && viewerRole !== "student") {
    return actor.employeeOrStudentId ? `Student · ${actor.employeeOrStudentId}` : "Student";
  }
  const name = `${actor.firstName ?? ""} ${actor.lastName ?? ""}`.trim();
  return name || (actor.role === "student" ? "Student" : "Unknown user");
}

export function getActorRoleLabel(actor: Actor | null | undefined) {
  return actor?.role ? roleLabel(actor.role) : "";
}
