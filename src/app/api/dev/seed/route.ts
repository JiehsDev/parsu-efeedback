import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { connectToDatabase } from "@/lib/db";
import { seedDevelopmentData } from "@/features/seed/seed.service";
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production")
    return NextResponse.json(
      { error: "Development seed is disabled in production." },
      { status: 403 },
    );
  if (env.DEV_SEED_SECRET && req.headers.get("x-dev-seed-secret") !== env.DEV_SEED_SECRET)
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  await connectToDatabase();
  return NextResponse.json(await seedDevelopmentData());
}
