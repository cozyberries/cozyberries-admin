import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET() {
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

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    const profileData = profile
      ? {
          id: profile.id,
          email: user.email ?? "",
          full_name: profile.full_name ?? user.user_metadata?.full_name ?? null,
          phone: profile.phone ?? null,
          updated_at: profile.updated_at ?? new Date().toISOString(),
        }
      : {
          id: user.id,
          email: user.email ?? "",
          full_name: user.user_metadata?.full_name ?? null,
          phone: null,
          updated_at: new Date().toISOString(),
        };

    return NextResponse.json({
      profile: profileData,
      addresses: [],
    });
  } catch (error) {
    console.error("Profile combined error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
