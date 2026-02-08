import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { ProductCreate } from "@/lib/types/product";
import { UpstashService } from "@/lib/upstash";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const featured = searchParams.get("featured") === "true";
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const sortBy = searchParams.get("sortBy") || "created_at";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";
    const offset = (page - 1) * limit;

    let query = supabase
      .from("products")
      .select("*, categories(name, slug)", { count: "exact" });

    if (featured) {
      query = query.eq("is_featured", true);
    }
    if (category) {
      query = query.eq("category_id", category);
    }
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
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
      products: products ?? [],
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    const body: ProductCreate & {
      stock_quantity?: number;
      is_featured?: boolean;
      category_id?: string;
      images?: string[];
    } = await request.json();

    // Validate required fields
    if (!body.name || typeof body.price !== "number") {
      return NextResponse.json(
        { error: "Name and price are required fields" },
        { status: 400 }
      );
    }

    // Create slug from name if not provided
    const slug = body.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Prepare data for insertion
    const productData = {
      name: body.name,
      description: body.description || null,
      price: body.price,
      slug: slug,
      stock_quantity: body.stock_quantity || 0,
      is_featured: body.is_featured || false,
      category_id: body.category_id || null,
      images: body.images || [],
    };

    const { data, error } = await supabase
      .from("products")
      .insert([productData])
      .select(
        `
        *,
        categories(name, slug)
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

    // Clear relevant cache entries after successful creation
    try {
      await Promise.all([
        // Clear all product list caches
        UpstashService.deletePattern("products:*"),
        // Clear featured products cache
        UpstashService.deletePattern("featured:products:*"),
        // Clear search caches
        UpstashService.deletePattern("products:search:*"),
      ]);
      console.log(`Cache cleared for new product ${data.id}`);
    } catch (cacheError) {
      console.error("Error clearing cache:", cacheError);
      // Don't fail the request if cache clearing fails
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
