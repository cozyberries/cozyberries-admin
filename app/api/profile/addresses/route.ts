import { NextRequest, NextResponse } from "next/server";
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

    try {
      const { data } = await supabase
        .from("user_addresses")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true);
      return NextResponse.json(data ?? []);
    } catch {
      return NextResponse.json([]);
    }
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(request: NextRequest) {
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
    const { data, error } = await supabase
      .from("user_addresses")
      .insert({
        user_id: user.id,
        address_type: body.address_type ?? "home",
        label: body.label ?? null,
        full_name: body.full_name ?? null,
        phone: body.phone ?? null,
        address_line_1: body.address_line_1 ?? "",
        address_line_2: body.address_line_2 ?? null,
        city: body.city ?? "",
        state: body.state ?? "",
        postal_code: body.postal_code ?? "",
        country: body.country ?? "India",
        is_default: body.is_default ?? false,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Address create error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
