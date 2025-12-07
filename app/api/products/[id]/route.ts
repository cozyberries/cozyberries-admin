import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { ProductUpdate } from "@/lib/types/product";
import { UpstashService } from "@/lib/upstash";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();

    // Get the current user
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

    const body: ProductUpdate & {
      stock_quantity?: number;
      is_featured?: boolean;
      category_id?: string;
      images?: string[];
    } = await request.json();
    const { id: productId } = await params;

    // Prepare update data
    const updateData: any = {};

    if (body.name !== undefined) {
      updateData.name = body.name;
      // Update slug if name is being updated
      updateData.slug = body.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    }

    if (body.description !== undefined)
      updateData.description = body.description;
    if (body.price !== undefined) updateData.price = body.price;
    if (body.stock_quantity !== undefined)
      updateData.stock_quantity = body.stock_quantity;
    if (body.is_featured !== undefined)
      updateData.is_featured = body.is_featured;
    if (body.category_id !== undefined)
      updateData.category_id = body.category_id;
    if (body.images !== undefined)
      updateData.images = body.images;

    const { data, error } = await supabase
      .from("products")
      .update(updateData)
      .eq("id", productId)
      .select(
        `
        *,
        categories(name, slug)
      `
      )
      .single();

    if (error) {
      return NextResponse.json(
        { error: `Failed to update product: ${error.message}` },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Clear relevant cache entries after successful update
    try {
      await Promise.all([
        // Clear individual product cache
        UpstashService.delete(`product:${productId}`),
        // Clear all product list caches (they use various patterns)
        UpstashService.deletePattern('products:*'),
        // Clear featured products cache if this product's featured status changed
        UpstashService.deletePattern('featured:products:*'),
        // Clear search caches
        UpstashService.deletePattern('products:search:*'),
      ]);
      console.log(`Cache cleared for product ${productId}`);
    } catch (cacheError) {
      console.error('Error clearing cache:', cacheError);
      // Don't fail the request if cache clearing fails
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();

    // Get the current user
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

    const { id: productId } = await params;

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", productId);

    if (error) {
      return NextResponse.json(
        { error: `Failed to delete product: ${error.message}` },
        { status: 500 }
      );
    }

    // Clear relevant cache entries after successful deletion
    try {
      await Promise.all([
        // Clear individual product cache
        UpstashService.delete(`product:${productId}`),
        // Clear all product list caches
        UpstashService.deletePattern('products:*'),
        // Clear featured products cache
        UpstashService.deletePattern('featured:products:*'),
        // Clear search caches
        UpstashService.deletePattern('products:search:*'),
      ]);
      console.log(`Cache cleared for deleted product ${productId}`);
    } catch (cacheError) {
      console.error('Error clearing cache:', cacheError);
      // Don't fail the request if cache clearing fails
    }

    return NextResponse.json({ message: "Product deleted successfully" });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
