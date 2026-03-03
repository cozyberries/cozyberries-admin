import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { ProductUpdate } from "@/lib/types/product";
import { UpstashService } from "@/lib/upstash";
import { RawProduct, normaliseProduct } from "@/lib/api/products";

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

    const body: ProductUpdate & {
      stock_quantity?: number;
      is_featured?: boolean;
      is_active?: boolean;
      category_slug?: string;
      images?: string[];
    } = await request.json();

    const { id: productSlug } = await params;

    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) {
      updateData.name = body.name;
      updateData.slug = body.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    }
    if (body.description !== undefined) updateData.description = body.description;
    if (body.price !== undefined) updateData.price = body.price;
    if (body.stock_quantity !== undefined) updateData.stock_quantity = body.stock_quantity;
    if (body.is_featured !== undefined) updateData.is_featured = body.is_featured;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    if (body.category_slug !== undefined) updateData.category_slug = body.category_slug;

    const { data, error } = await supabase
      .from("products")
      .update(updateData)
      .eq("slug", productSlug)
      .select(
        `
        *,
        categories!products_category_slug_fkey(name, slug),
        product_images(url, is_primary, display_order),
        product_variants(slug, product_slug, size_slug, color_slug, price, stock_quantity)
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

    // Replace product_images if images array is provided.
    // Safe pattern: snapshot existing rows → delete → insert new → restore on failure.
    if (body.images !== undefined) {
      const finalSlug = (updateData.slug as string | undefined) ?? productSlug;

      const { data: existingImages } = await supabase
        .from("product_images")
        .select("url, is_primary, display_order")
        .eq("product_slug", productSlug);

      const { error: delError } = await supabase
        .from("product_images")
        .delete()
        .eq("product_slug", productSlug);

      if (delError) {
        console.error("Failed to delete old product images:", delError.message);
        return NextResponse.json(
          { error: `Failed to update product images: ${delError.message}` },
          { status: 500 }
        );
      }

      if (body.images.length > 0) {
        const imageRows = body.images.map((url, idx) => ({
          product_slug: finalSlug,
          url,
          is_primary: idx === 0,
          display_order: idx,
        }));

        const { error: imgError } = await supabase
          .from("product_images")
          .insert(imageRows);

        if (imgError) {
          console.error("Failed to insert new product images:", imgError.message);
          // Restore previous images so the product is not left without images.
          // Use finalSlug (the current slug after potential rename) so restored rows
          // reference the correct product — productSlug is the pre-update value.
          if (existingImages && existingImages.length > 0) {
            const restoreRows = existingImages.map((img) => ({
              ...img,
              product_slug: finalSlug,
            }));
            await supabase.from("product_images").insert(restoreRows);
          }
          return NextResponse.json(
            { error: `Failed to update product images: ${imgError.message}` },
            { status: 500 }
          );
        }
      }
    }

    try {
      await Promise.all([
        UpstashService.delete(`product:${productSlug}`),
        UpstashService.deletePattern("products:*"),
        UpstashService.deletePattern("featured:products:*"),
        UpstashService.deletePattern("products:search:*"),
      ]);
    } catch (cacheError) {
      console.error("Error clearing cache:", cacheError);
    }

    return NextResponse.json(normaliseProduct(data as RawProduct));
  } catch {
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

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("slug", productSlug);

    if (error) {
      return NextResponse.json(
        { error: `Failed to delete product: ${error.message}` },
        { status: 500 }
      );
    }

    try {
      await Promise.all([
        UpstashService.delete(`product:${productSlug}`),
        UpstashService.deletePattern("products:*"),
        UpstashService.deletePattern("featured:products:*"),
        UpstashService.deletePattern("products:search:*"),
      ]);
    } catch (cacheError) {
      console.error("Error clearing cache:", cacheError);
    }

    return NextResponse.json({ message: "Product deleted successfully" });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
