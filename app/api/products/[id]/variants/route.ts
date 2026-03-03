import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { UpstashService } from "@/lib/upstash";

/**
 * PATCH /api/products/[id]/variants
 *
 * Updates `price` and/or `stock_quantity` for a single variant.
 * Body: { variantSlug: string; price?: number; stock_quantity?: number }
 */
export async function PATCH(
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

    const { id: productSlug } = await params;
    const body: { variantSlug: string; price?: number; stock_quantity?: number } =
      await request.json();

    if (!body.variantSlug) {
      return NextResponse.json(
        { error: "variantSlug is required" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (body.price !== undefined) {
      if (typeof body.price !== "number" || isNaN(body.price) || body.price < 0) {
        return NextResponse.json({ error: "Invalid price" }, { status: 400 });
      }
      updateData.price = body.price;
    }

    if (body.stock_quantity !== undefined) {
      if (
        typeof body.stock_quantity !== "number" ||
        isNaN(body.stock_quantity) ||
        body.stock_quantity < 0 ||
        !Number.isInteger(body.stock_quantity)
      ) {
        return NextResponse.json({ error: "Invalid stock_quantity" }, { status: 400 });
      }
      updateData.stock_quantity = body.stock_quantity;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("product_variants")
      .update(updateData)
      .eq("slug", body.variantSlug)
      .eq("product_slug", productSlug)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: `Failed to update variant: ${error.message}` },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ error: "Variant not found" }, { status: 404 });
    }

    try {
      await Promise.all([
        UpstashService.delete(`product:${productSlug}`),
        UpstashService.deletePattern("products:*"),
      ]);
    } catch (cacheError) {
      console.error("Error clearing cache:", cacheError);
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
