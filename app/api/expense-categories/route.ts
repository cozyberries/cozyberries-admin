import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createAdminSupabaseClient,
} from "@/lib/supabase-server";
import { authenticateRequest } from "@/lib/jwt-auth";
import {
  ExpenseCategoryCreate,
  ExpenseCategoryData,
} from "@/lib/types/expense";

export async function GET(request: NextRequest) {
  try {
    // Authenticate the request using JWT
    const auth = await authenticateRequest(request);

    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("include_inactive") === "true";
    const adminView = searchParams.get("admin") === "true";

    let query = supabase
      .from("expense_categories")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("display_name", { ascending: true });

    // For admin view, show all categories; for regular users, only active ones
    if (!adminView || !auth.isAdmin) {
      query = query.eq("is_active", true);
    } else if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    const { data: categories, error } = await query;

    if (error) {
      console.error("Error fetching expense categories:", error);
      return NextResponse.json(
        { error: "Failed to fetch expense categories" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      categories: categories || [],
      count: categories?.length || 0,
    });
  } catch (error) {
    console.error("Error in expense categories GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request using JWT
    const auth = await authenticateRequest(request);

    if (!auth.isAuthenticated || !auth.isAdmin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const supabase = createAdminSupabaseClient();
    const body: ExpenseCategoryCreate = await request.json();

    // Validate required fields
    if (!body.name || !body.display_name) {
      return NextResponse.json(
        { error: "Name and display name are required fields" },
        { status: 400 }
      );
    }

    // Generate slug from name if not provided
    const generateSlug = (name: string): string => {
      return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    };

    const baseSlug = generateSlug(body.name);
    
    // Check if slug already exists and generate unique one if needed
    let finalSlug = baseSlug;
    let counter = 0;
    
    while (true) {
      const { data: existing } = await supabase
        .from("expense_categories")
        .select("id")
        .eq("slug", finalSlug)
        .single();
        
      if (!existing) break;
      
      counter++;
      finalSlug = `${baseSlug}-${counter}`;
    }

    // Check if name already exists
    const { data: existingName } = await supabase
      .from("expense_categories")
      .select("id")
      .eq("name", body.name)
      .single();

    if (existingName) {
      return NextResponse.json(
        { error: "A category with this name already exists" },
        { status: 400 }
      );
    }

    // Get the highest sort_order for new categories
    const { data: maxOrderData } = await supabase
      .from("expense_categories")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .single();

    const nextSortOrder = (maxOrderData?.sort_order || 0) + 1;

    // Prepare data for insertion
    const categoryData = {
      name: body.name,
      slug: finalSlug,
      display_name: body.display_name,
      description: body.description || null,
      color: body.color || "#6B7280",
      icon: body.icon || "folder",
      sort_order: body.sort_order || nextSortOrder,
      is_active: true,
      is_system: false,
      created_by: auth.userId,
    };

    const { data, error } = await supabase
      .from("expense_categories")
      .insert([categoryData])
      .select("*")
      .single();

    if (error) {
      console.error("Error creating expense category:", error);
      return NextResponse.json(
        { error: `Failed to create expense category: ${error.message}` },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "No data returned from database" },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Error creating expense category:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
