import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await request.json();

    // Whitelist permitted fields to prevent mass-assignment
    const allowedFields = ["street", "city", "state", "zip", "country", "phone", "address_line_1", "address_line_2", "postal_code", "address_type", "label", "full_name", "is_default"];
    const sanitizedUpdate: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    // Only include allowed fields from the request body
    for (const field of allowedFields) {
      if (field in body) {
        sanitizedUpdate[field] = body[field];
      }
    }

    // If setting this address as default, use atomic RPC to ensure single default
    if (body.is_default === true) {
      // Remove is_default from sanitizedUpdate since RPC handles it atomically
      const { is_default, ...updateWithoutDefault } = sanitizedUpdate;
      
      // Call RPC to atomically clear other defaults AND set this address as default
      const { error: rpcError } = await supabase.rpc('ensure_single_default_address', {
        p_user_id: user.id,
        p_address_id: id
      });

      if (rpcError) {
        console.error("Failed to update default address:", rpcError);
        return NextResponse.json(
          { error: "Failed to update defaults" },
          { status: 500 }
        );
      }

      // If there are other fields to update besides is_default, perform the update
      if (Object.keys(updateWithoutDefault).length > 1) { // > 1 because updated_at is always present
        const { data: updateData, error: updateError } = await supabase
          .from("user_addresses")
          .update(updateWithoutDefault)
          .eq("id", id)
          .eq("user_id", user.id)
          .select()
          .single();

        if (updateError) {
          return NextResponse.json(
            { error: updateError.message },
            { status: 400 }
          );
        }

        return NextResponse.json(updateData);
      }

      // If only is_default was being updated, fetch and return the updated address
      const { data: fetchedData, error: fetchError } = await supabase
        .from("user_addresses")
        .select()
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (fetchError) {
        return NextResponse.json(
          { error: fetchError.message },
          { status: 400 }
        );
      }

      return NextResponse.json(fetchedData);
    }

    // For non-default updates, use regular update
    const { data, error } = await supabase
      .from("user_addresses")
      .update(sanitizedUpdate)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Address update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const { data, error } = await supabase
      .from("user_addresses")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)
      .select();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    if (data == null || data.length === 0) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Address delete error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
