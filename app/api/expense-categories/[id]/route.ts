import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { authenticateRequest } from "@/lib/jwt-auth";
import { ExpenseCategoryUpdate } from "@/lib/types/expense";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
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

    const { data: category, error } = await supabase
      .from("expense_categories")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error || !category) {
      return NextResponse.json(
        { error: "Expense category not found" },
        { status: 404 }
      );
    }

    // Non-admin users can only see active categories
    if (!auth.isAdmin && !category.is_active) {
      return NextResponse.json(
        { error: "Expense category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(category);
  } catch (error) {
    console.error("Error fetching expense category:", error);
    return NextResponse.json(
      { error: "Failed to fetch expense category" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    // Authenticate the request using JWT
    const auth = await authenticateRequest(request);

    if (!auth.isAuthenticated || !auth.isAdmin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const body: ExpenseCategoryUpdate = await request.json();

    // First, check if category exists and get current data
    const { data: existingCategory, error: fetchError } = await supabase
      .from("expense_categories")
      .select("*")
      .eq("id", params.id)
      .single();

    if (fetchError || !existingCategory) {
      return NextResponse.json(
        { error: "Expense category not found" },
        { status: 404 }
      );
    }

    // Prevent updating system categories' core properties
    if (existingCategory.is_system && (body.name || body.slug)) {
      return NextResponse.json(
        { error: "Cannot modify name or slug of system categories" },
        { status: 400 }
      );
    }

    // Validate unique constraints if name is being updated
    if (body.name && body.name !== existingCategory.name) {
      const { data: nameCheck } = await supabase
        .from("expense_categories")
        .select("id")
        .eq("name", body.name)
        .neq("id", params.id)
        .single();

      if (nameCheck) {
        return NextResponse.json(
          { error: "A category with this name already exists" },
          { status: 400 }
        );
      }
    }

    // Generate new slug if name is updated
    let updateData: any = { ...body };

    if (body.name && body.name !== existingCategory.name && !existingCategory.is_system) {
      const generateSlug = (name: string): string => {
        return name
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
      };

      const baseSlug = generateSlug(body.name);
      let finalSlug = baseSlug;
      let counter = 0;

      while (true) {
        const { data: existing } = await supabase
          .from("expense_categories")
          .select("id")
          .eq("slug", finalSlug)
          .neq("id", params.id)
          .single();

        if (!existing) break;

        counter++;
        finalSlug = `${baseSlug}-${counter}`;
      }

      updateData.slug = finalSlug;
    }

    const { data, error } = await supabase
      .from("expense_categories")
      .update(updateData)
      .eq("id", params.id)
      .select("*")
      .single();

    if (error) {
      console.error("Error updating expense category:", error);
      return NextResponse.json(
        { error: `Failed to update expense category: ${error.message}` },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Expense category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error updating expense category:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    // Authenticate the request using JWT
    const auth = await authenticateRequest(request);

    if (!auth.isAuthenticated || !auth.isAdmin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const supabase = await createServerSupabaseClient();

    // First, check if category exists and is not a system category
    const { data: category, error: fetchError } = await supabase
      .from("expense_categories")
      .select("*, expenses(count)")
      .eq("id", params.id)
      .single();

    if (fetchError || !category) {
      return NextResponse.json(
        { error: "Expense category not found" },
        { status: 404 }
      );
    }

    // Prevent deletion of system categories
    if (category.is_system) {
      return NextResponse.json(
        { error: "Cannot delete system categories" },
        { status: 400 }
      );
    }

    // Check if category is being used by any expenses
    const { data: expenseCount, error: countError } = await supabase
      .from("expenses")
      .select("id", { count: "exact", head: true })
      .eq("category_id", params.id);

    if (countError) {
      console.error("Error checking expense usage:", countError);
      return NextResponse.json(
        { error: "Failed to check category usage" },
        { status: 500 }
      );
    }

    // If category is being used, prevent deletion
    if (expenseCount && expenseCount.length > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete category that is being used by expenses",
          details: `This category is used by ${expenseCount.length} expense(s)`
        },
        { status: 400 }
      );
    }

    // Perform soft delete by setting is_active to false instead of hard delete
    const { error: deleteError } = await supabase
      .from("expense_categories")
      .update({ is_active: false })
      .eq("id", params.id);

    if (deleteError) {
      console.error("Error deleting expense category:", deleteError);
      return NextResponse.json(
        { error: `Failed to delete expense category: ${deleteError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Expense category deleted successfully",
      id: params.id
    });
  } catch (error) {
    console.error("Error deleting expense category:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
