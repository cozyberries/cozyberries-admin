import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { ProductCreate } from "@/lib/types/product";
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

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const featured = searchParams.get("featured") === "true";
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";

    const allowedSortColumns = ["created_at", "name", "price", "updated_at"];
    const sortByParam = searchParams.get("sortBy") || "created_at";
    const sortBy = allowedSortColumns.includes(sortByParam) ? sortByParam : "created_at";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";
    const offset = (page - 1) * limit;

    let query = supabase.from("products").select(
      `
        *,
        categories!products_category_slug_fkey(name, slug),
        product_images(url, is_primary, display_order),
        product_variants(slug, product_slug, size_slug, color_slug, price, stock_quantity)
      `,
      { count: "exact" }
    );

    if (featured) {
      query = query.eq("is_featured", true);
    }
    if (category) {
      query = query.eq("category_slug", category);
    }
    if (search) {
      const escaped = search
        .replace(/\\/g, "\\\\")
        .replace(/%/g, "\\%")
        .replace(/_/g, "\\_");
      const safePattern = `%${escaped}%`;
      query = query.or(`name.ilike.${safePattern},description.ilike.${safePattern}`);
    }

    const { data: products, error, count } = await query
      .order(sortBy, { ascending: sortOrder === "asc" })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json(
        { error: `Failed to fetch products: ${error.message}` },
        { status: 500 }
      );
    }

    const totalItems = count ?? 0;
    const totalPages = Math.ceil(totalItems / limit) || 1;

    return NextResponse.json({
      products: (products ?? []).map((p) => normaliseProduct(p as RawProduct)),
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
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

    const body: ProductCreate & {
      stock_quantity?: number;
      is_featured?: boolean;
      category_slug?: string;
      images?: string[];
    } = await request.json();

    if (!body.name || typeof body.price !== "number") {
      return NextResponse.json(
        { error: "Name and price are required fields" },
        { status: 400 }
      );
    }

    const slug = body.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const productData = {
      name: body.name,
      description: body.description || null,
      price: body.price,
      slug,
      stock_quantity: body.stock_quantity ?? 0,
      is_featured: body.is_featured ?? false,
      category_slug: body.category_slug || null,
    };

    const { data, error } = await supabase
      .from("products")
      .insert([productData])
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
        { error: `Failed to create product: ${error.message}` },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "No data returned from database" },
        { status: 500 }
      );
    }

    // Insert images into product_images table if provided
    const imageUrls: string[] = body.images ?? [];
    if (imageUrls.length > 0) {
      const imageRows = imageUrls.map((url, idx) => ({
        product_slug: slug,
        url,
        is_primary: idx === 0,
        display_order: idx,
      }));

      const { error: imgError } = await supabase
        .from("product_images")
        .insert(imageRows);

      if (imgError) {
        console.error("Failed to insert product images:", imgError.message);
      }
    }

    try {
      await Promise.all([
        UpstashService.deletePattern("products:*"),
        UpstashService.deletePattern("featured:products:*"),
        UpstashService.deletePattern("products:search:*"),
      ]);
    } catch (cacheError) {
      console.error("Error clearing cache:", cacheError);
    }

    return NextResponse.json(normaliseProduct(data as RawProduct), { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
