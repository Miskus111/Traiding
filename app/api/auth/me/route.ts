import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasDatabase } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    user: await getCurrentUser(),
    databaseReady: hasDatabase(),
  });
}
