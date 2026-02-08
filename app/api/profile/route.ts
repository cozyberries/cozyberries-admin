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

    if (profile) {
      return NextResponse.json({
        id: profile.id,
        email: user.email ?? "",
        full_name: profile.full_name ?? user.user_metadata?.full_name ?? null,
        phone: profile.phone ?? null,
        updated_at: profile.updated_at ?? new Date().toISOString(),
      });
    }

    return NextResponse.json({
      id: user.id,
      email: user.email ?? "",
      full_name: user.user_metadata?.full_name ?? null,
      phone: null,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Profile get error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
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

    const body = await request.json();
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (body.full_name !== undefined) updates.full_name = body.full_name;
    if (body.phone !== undefined) updates.phone = body.phone;

    const { error } = await supabase
      .from("user_profiles")
      .upsert(
        { id: user.id, ...updates },
        { onConflict: "id" }
      );

    if (error) {
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      );
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    return NextResponse.json(
      profile
        ? {
            id: profile.id,
            email: user.email ?? "",
            full_name: profile.full_name ?? null,
            phone: profile.phone ?? null,
            updated_at: profile.updated_at,
          }
        : {
            id: user.id,
            email: user.email ?? "",
            full_name: updates.full_name ?? null,
            phone: updates.phone ?? null,
            updated_at: updates.updated_at,
          }
    );
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
