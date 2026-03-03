import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwt-auth";

// GET: return notifications for the authenticated user (used by NotificationCenter)
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);

    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: "Authentication required. Please sign in to view notifications." },
        { status: 401 }
      );
    }

    // Notifications scoped to this user (stub: empty list; replace with DB query when ready)
    const notifications: unknown[] = [];
    return NextResponse.json({ notifications });
  } catch (error) {
    console.error("Notifications fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
