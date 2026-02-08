import { NextRequest, NextResponse } from "next/server";

// GET: return empty activities list (used by AnalyticsDashboard)
export async function GET() {
  return NextResponse.json([]);
}

// POST: stub for activity logging (used by lib/utils/activities.ts)
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }
  // Stub: body is parsed for validation only; full logging not implemented yet.
  return NextResponse.json({ success: true });
}
