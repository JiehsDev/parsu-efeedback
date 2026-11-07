export interface SessionAuthorizationClaims {
  role: string;
  officeRef: string | null;
  collegeRef: string | null;
}

export function sessionAuthorizationClaimsMatch(
  user: { role: string; officeRef?: unknown; collegeRef?: unknown },
  claims: SessionAuthorizationClaims,
): boolean {
  return (
    user.role === claims.role &&
    String(user.officeRef ?? "") === String(claims.officeRef ?? "") &&
    String(user.collegeRef ?? "") === String(claims.collegeRef ?? "")
  );
}
