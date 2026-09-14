import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-server";
import { authenticateRequest, isAdminUser, type UserPayload } from "@/lib/jwt-auth";

// POST: create or ensure user profile exists (used by supabase-auth-provider after sign-in)
export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.isAuthenticated || !isAdminUser(auth.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = auth.user as UserPayload;

    const supabase = createAdminSupabaseClient();
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .upsert(
        {
          id: user.id,
          full_name: user.username ?? user.email?.split("@")[0] ?? "User",
          role: user.role ?? "customer",
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
