import { NextResponse } from "next/server";

// GET: return empty notifications list (used by NotificationCenter)
export async function GET() {
  return NextResponse.json({ notifications: [] });
}
