import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwt-auth";
import { createAdminSupabaseClient } from "@/lib/supabase-server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.isAuthenticated || !auth.userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Notification ID is required" }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();

    // Allow marking as read if the notification belongs to this admin OR is a broadcast (user_id IS NULL).
    const { data, error } = await supabase
      .from("notifications")
      .update({ read: true, updated_at: new Date().toISOString() })
      .eq("id", id)
      .or(`user_id.eq.${auth.userId},user_id.is.null`)
      .select("id, user_id, title, message, type, read, meta, created_at, updated_at")
      .maybeSingle();

    if (error) {
      console.error("Notification update DB error:", error);
      return NextResponse.json({ error: "Failed to update notification" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Notification not found or unauthorized" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Notification update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
