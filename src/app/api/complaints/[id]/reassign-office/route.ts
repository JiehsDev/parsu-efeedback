import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
export async function POST() {
  const session = await auth();
  return NextResponse.json(
    {
      error: session?.user
        ? "Use controlled forwarding. Only the OSAS Head may forward to VPAA or VPAF."
        : "Unauthorized",
    },
    { status: session?.user ? 403 : 401 },
  );
}
