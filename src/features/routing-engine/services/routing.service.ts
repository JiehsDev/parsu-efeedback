// Centralized operational routing. Legacy routing conditions are retained only for history.
import { getOperationalOffice } from "@/lib/osas-operations";
import type { PriorityLevel } from "@/lib/constants";
export class RoutingError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}
export async function resolveRoutingOffice(_params: {
  categoryId: string;
  studentCollegeRef: string | null;
  priority: PriorityLevel;
}): Promise<{ officeRef: string }> {
  void _params;
  const office = await getOperationalOffice();
  if (!office)
    throw new RoutingError("OSAS is unavailable. Contact an administrator.", "OSAS_UNAVAILABLE");
  return { officeRef: String(office._id) };
}
