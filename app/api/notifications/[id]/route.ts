import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// PATCH: mark notification as read (used by NotificationCenter)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get and validate notification ID
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        { error: "Notification ID is required" },
        { status: 400 }
      );
    }

    // Verify notification belongs to user and mark as read
    const { data, error } = await supabase
      .from("notifications")
      .update({ read: true, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      // Check if it's a not-found error or unauthorized
      const errorMessage = (error as { message?: string; code?: string }).message || "Database error";
      const errorCode = (error as { message?: string; code?: string }).code;
      
      if (errorCode === 'PGRST116' || errorMessage.includes('no rows')) {
        return NextResponse.json(
          { error: "Notification not found or unauthorized" },
          { status: 404 }
        );
      }
      
      // Other database errors
      console.error("Database error updating notification:", error);
      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Notification update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
