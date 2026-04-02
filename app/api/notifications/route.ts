import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwt-auth";
import { createAdminSupabaseClient } from "@/lib/supabase-server";

const PAGE_SIZE = 50;

type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  meta: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

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

    const userId = auth.userId;
    if (!userId) {
      return NextResponse.json(
        { error: "Authenticated user ID is missing." },
        { status: 401 }
      );
    }

    const cursor = request.nextUrl.searchParams.get("cursor");
    if (cursor) {
      const cursorDate = new Date(cursor);
      if (Number.isNaN(cursorDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid cursor. Expected an ISO datetime string." },
          { status: 400 }
        );
      }
    }

    const supabase = createAdminSupabaseClient();
    // Return notifications for this admin (user_id = their id) AND
    // broadcast / legacy notifications that have no specific user (user_id IS NULL).
    let query = supabase
      .from("notifications")
      .select("id, user_id, title, message, type, read, meta, created_at, updated_at")
      .or(`user_id.eq.${userId},user_id.is.null`)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (cursor) {
      query = query.lt("created_at", cursor);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Notifications query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch notifications." },
        { status: 500 }
      );
    }

    const rows = (data ?? []) as NotificationRow[];
    const notifications = rows.map(({ read, ...row }) => ({
      ...row,
      is_read: read,
    }));
    const next_cursor =
      rows.length === PAGE_SIZE ? rows[rows.length - 1]?.created_at ?? null : null;

    return NextResponse.json({ notifications, next_cursor });
  } catch (error) {
    console.error("Notifications fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
