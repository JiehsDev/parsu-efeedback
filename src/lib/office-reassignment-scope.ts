// src/lib/office-reassignment-scope.ts
//
// REASSIGN OFFICE is a lateral transfer to another office of the same or
// equivalent organizational level — never upward (that's Escalate). The
// Office model only has `type` (college_office | university_office) and a
// single `parentOffice` pointer, no explicit "level"/"authorityGroup"
// field, so eligibility is derived from those two instead of hardcoding
// specific office names/codes:
//
//   (a) true siblings — same `type` AND the same non-null `parentOffice`
//       (e.g. every college shares parentOffice=OVPAA; GSO/Registrar/QAO
//       share parentOffice=OVPAF)
//   (b) a university office may hand off to any active college — a
//       college is a peer organizational unit, not subordinate to any one
//       university office (this generalizes the "Registrar -> College of
//       Science" case to every university office), EXCLUDING a college
//       that is actually this office's own child (parentOffice === this
//       office's _id) — reaching down to your own child isn't lateral.
//
// Always excluded: the current office itself, inactive offices, and the
// current office's own parentOffice (that's upward -> use Escalate).
import { Office } from "@/models/Office";

interface OfficeLike {
  _id: unknown;
  type: string;
  parentOffice?: unknown;
}

export async function getEligibleReassignmentOffices(currentOffice: OfficeLike) {
  const currentId = String(currentOffice._id);
  const parentId = currentOffice.parentOffice ? String(currentOffice.parentOffice) : null;

  const candidates = await Office.find({ isActive: true, _id: { $ne: currentOffice._id } })
    .select("name code type parentOffice")
    .sort({ name: 1 })
    .lean();

  return candidates.filter((candidate: any) => {
    const candidateId = String(candidate._id);
    if (candidateId === parentId) return false; // upward -> Escalate, not this

    const candidateParentId = candidate.parentOffice ? String(candidate.parentOffice) : null;
    const isSibling =
      candidate.type === currentOffice.type && parentId !== null && candidateParentId === parentId;
    const isUniversityToCollegeHandoff =
      currentOffice.type === "university_office" &&
      candidate.type === "college_office" &&
      candidateParentId !== currentId; // not this office's own child

    return isSibling || isUniversityToCollegeHandoff;
  });
}
