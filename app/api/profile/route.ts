import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const FULL_NAME_MAX_LENGTH = 100;
const PHONE_MAX_LENGTH = 20;
/** E.164 / basic: optional +, then digits and common separators (space, hyphen, parens, dot) */
const PHONE_PATTERN = /^\+?[\d\s\-().]*\d[\d\s\-().]*$/;

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

    if (body.full_name !== undefined) {
      const fullName =
        typeof body.full_name === "string" ? body.full_name.trim() : "";
      if (fullName.length > FULL_NAME_MAX_LENGTH) {
        return NextResponse.json(
          {
            error: `full_name must be at most ${FULL_NAME_MAX_LENGTH} characters`,
          },
          { status: 400 }
        );
      }
      updates.full_name = fullName || null;
    }
    if (body.phone !== undefined) {
      const phone =
        typeof body.phone === "string" ? body.phone.trim() : body.phone === null ? "" : String(body.phone);
      if (phone.length > PHONE_MAX_LENGTH) {
        return NextResponse.json(
          {
            error: `phone must be at most ${PHONE_MAX_LENGTH} characters`,
          },
          { status: 400 }
        );
      }
      // Only validate format if phone is provided
      if (phone.length > 0 && !PHONE_PATTERN.test(phone)) {
        return NextResponse.json(
          { error: "phone must be a valid number (E.164 or digits with optional +, spaces, hyphens, parentheses)" },
          { status: 400 }
        );
      }
      updates.phone = phone || null;
    }

    const { data: profile, error } = await supabase
      .from("user_profiles")
      .upsert({ id: user.id, ...updates }, { onConflict: "id" })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: profile.id,
      email: user.email ?? "",
      full_name: profile.full_name ?? null,
      phone: profile.phone ?? null,
      updated_at: profile.updated_at,
    });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
