import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { ProductUpdate } from "@/lib/types/product";
import { UpstashService } from "@/lib/upstash";

type RawProduct = {
  slug: string;
  name: string;
  description?: string | null;
  price: number;
  care_instructions?: string | null;
  stock_quantity?: number | null;
  is_featured?: boolean;
  category_slug?: string | null;
  gender_slug?: string | null;
  size_slugs?: string[];
  color_slugs?: string[];
  created_at: string;
  updated_at?: string;
  categories?: { name: string; slug: string } | null;
  product_images?: { url: string; is_primary: boolean; display_order: number | null }[];
  product_variants?: {
    slug: string;
    product_slug: string;
    size_slug: string;
    color_slug: string;
    price: number;
    stock_quantity: number;
  }[];
};

function normaliseProduct(p: RawProduct) {
  const images = (p.product_images ?? [])
    .sort((a, b) => {
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;
      return (a.display_order ?? 0) - (b.display_order ?? 0);
    })
    .map((img) => img.url)
    .filter(Boolean);

  const variants = (p.product_variants ?? []).sort((a, b) =>
    a.size_slug.localeCompare(b.size_slug)
  );

  return {
    ...p,
    id: p.slug,
    images,
    variants,
    product_images: undefined,
    product_variants: undefined,
  };
}

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

    // Replace product_images if images array is provided
    if (body.images !== undefined) {
      await supabase.from("product_images").delete().eq("product_slug", productSlug);

      if (body.images.length > 0) {
        const imageRows = body.images.map((url, idx) => ({
          product_slug: (updateData.slug as string | undefined) ?? productSlug,
          url,
          is_primary: idx === 0,
          display_order: idx,
        }));
        const { error: imgError } = await supabase
          .from("product_images")
          .insert(imageRows);
        if (imgError) {
          console.error("Failed to update product images:", imgError.message);
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
