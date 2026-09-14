import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-server";
import { authenticateRequest, isAdminUser, type UserPayload } from "@/lib/jwt-auth";

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.isAuthenticated || !isAdminUser(auth.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = auth.user as UserPayload;

    const supabase = createAdminSupabaseClient();
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError && profileError.code !== "PGRST116") {
      // PGRST116 is "no rows returned" which is acceptable
      console.error("Profile fetch error:", profileError);
      return NextResponse.json(
        { error: "Failed to fetch profile" },
        { status: 500 }
      );
    }

    const profileData = profile
      ? {
          id: profile.id,
          email: user.email ?? "",
          full_name: profile.full_name ?? user.username ?? null,
          phone: profile.phone ?? null,
          updated_at: profile.updated_at ?? new Date().toISOString(),
        }
      : {
          id: user.id,
          email: user.email ?? "",
          full_name: user.username ?? null,
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
