import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// POST: create or ensure user profile exists (used by supabase-auth-provider after sign-in)
export async function POST() {
  try {
    const supabase = await createServerSupabaseClient();
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

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .upsert(
        {
          id: user.id,
          full_name: user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "User",
          role: user.user_metadata?.role ?? "customer",
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )
      .select()
      .single();

    if (profileError || !profile) {
      console.error("Error creating/updating profile:", profileError);
      return NextResponse.json(
        { error: "Failed to create profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      profile: {
        id: profile.id,
        role: profile.role,
      },
    });
  } catch (error) {
    console.error("Profile create error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
