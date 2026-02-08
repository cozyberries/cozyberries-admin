import { NextRequest, NextResponse } from "next/server";

// GET: return empty activities list (used by AnalyticsDashboard)
export async function GET() {
  return NextResponse.json([]);
}

// POST: stub for activity logging (used by lib/utils/activities.ts)
export async function POST(request: NextRequest) {
  try {
    await request.json();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true });
  }
}
