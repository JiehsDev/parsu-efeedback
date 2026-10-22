import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
export async function POST() {
  const session = await auth();
  return NextResponse.json(
    {
      error: session?.user
        ? "Office reassignment is disabled. OSAS is the only handling office."
        : "Unauthorized",
    },
    { status: session?.user ? 403 : 401 },
  );
}
