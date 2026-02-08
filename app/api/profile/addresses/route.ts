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
    } catch (err) {
      console.error(
        "[GET /api/profile/addresses] Supabase query failed: user_addresses select * where user_id=%s and is_active=true",
        user.id,
        err
      );
      return NextResponse.json([]);
    }
  } catch (err) {
    console.error(
      "[GET /api/profile/addresses] Auth or Supabase client failed",
      err
    );
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
    
    // Validate required fields
    if (!body.address_line_1 || !body.address_line_1.trim()) {
      return NextResponse.json(
        { error: "address_line_1 is required" },
        { status: 400 }
      );
    }
    if (!body.city || !body.city.trim()) {
      return NextResponse.json(
        { error: "city is required" },
        { status: 400 }
      );
    }
    if (!body.state || !body.state.trim()) {
      return NextResponse.json(
        { error: "state is required" },
        { status: 400 }
      );
    }
    if (!body.postal_code || !body.postal_code.trim()) {
      return NextResponse.json(
        { error: "postal_code is required" },
        { status: 400 }
      );
    }

    // Use RPC to atomically handle default address logic
    const addressData = {
      user_id: user.id,
      address_type: body.address_type ?? "home",
      label: body.label ?? null,
      full_name: body.full_name ?? null,
      phone: body.phone ?? null,
      address_line_1: body.address_line_1,
      address_line_2: body.address_line_2 ?? null,
      city: body.city,
      state: body.state,
      postal_code: body.postal_code,
      country: body.country ?? "India",
      is_default: body.is_default ?? false,
      is_active: true,
    };

    const { data, error } = await supabase
      .rpc('ensure_single_default_address', {
        p_user_id: user.id,
        p_address_type: addressData.address_type,
        p_label: addressData.label,
        p_full_name: addressData.full_name,
        p_phone: addressData.phone,
        p_address_line_1: addressData.address_line_1,
        p_address_line_2: addressData.address_line_2,
        p_city: addressData.city,
        p_state: addressData.state,
        p_postal_code: addressData.postal_code,
        p_country: addressData.country,
        p_is_default: addressData.is_default,
        p_is_active: addressData.is_active,
      });

    if (error) {
      console.error("Failed to create address via RPC:", error);
      return NextResponse.json(
        { error: "Failed to create address" },
        { status: 500 }
      );
    }

    // RPC returns an array with one row, extract it
    const newAddress = Array.isArray(data) && data.length > 0 ? data[0] : data;

    return NextResponse.json(newAddress, { status: 201 });
  } catch (error) {
    console.error("Address create error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
