// Compatibility helpers: complaint handling and supervisory review are OSAS-only.
import { getOperationalOffice, isOsasComplaint } from "./osas-operations";
export const getOsasOffice = getOperationalOffice;
export async function getOvpaaOffice() {
  return null;
}
export async function getOsasComplaintFilter(): Promise<Record<string, unknown>> {
  const office = await getOperationalOffice();
  return office ? { assignedOfficeRef: office._id } : { _id: { $in: [] } };
}
export const isComplaintInOsasActionScope = isOsasComplaint;
export async function getOsasAllowedDestinationOffices(complaint: any) {
  const office = await getOperationalOffice();
  return office && (await isOsasComplaint(complaint)) ? [office] : [];
}
export const getOsasEscalationOffice = getOperationalOffice;
