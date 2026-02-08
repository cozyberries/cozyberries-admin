import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// GET: return notifications for the authenticated user (used by NotificationCenter)
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Authentication required. Please sign in to view notifications." },
      { status: 401 }
    );
  }

  // Notifications scoped to this user (stub: empty list; replace with DB query when ready)
  const notifications: unknown[] = [];
  return NextResponse.json({ notifications });
}
