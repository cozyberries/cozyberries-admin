import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createAdminSupabaseClient,
} from "@/lib/supabase-server";
import { authenticateRequest } from "@/lib/jwt-auth";
import {
  ExpenseCreate,
  ExpenseFilters,
  ExpenseStats,
} from "@/lib/types/expense";

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const priority = searchParams.get("priority");
    const user_id = searchParams.get("user_id");
    const date_from = searchParams.get("date_from");
    const date_to = searchParams.get("date_to");
    const amount_min = searchParams.get("amount_min");
    const amount_max = searchParams.get("amount_max");
    const search = searchParams.get("search");

    // First, get the expenses with category data
    let query = supabase
      .from("expenses")
      .select(
        `
        *,
        category_data:expense_categories(
          id,
          name,
          slug,
          display_name,
          description,
          color,
          icon,
          sort_order
        )
      `
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (category && category !== "all") {
      query = query.eq("category", category);
    }

    if (priority && priority !== "all") {
      query = query.eq("priority", priority);
    }

    if (user_id) {
      query = query.eq("user_id", user_id);
    }

    if (date_from) {
      query = query.gte("expense_date", date_from);
    }

    if (date_to) {
      query = query.lte("expense_date", date_to);
    }

    if (amount_min) {
      query = query.gte("amount", parseFloat(amount_min));
    }

    if (amount_max) {
      query = query.lte("amount", parseFloat(amount_max));
    }

    if (search) {
      query = query.or(
        `title.ilike.%${search}%,description.ilike.%${search}%,vendor.ilike.%${search}%`
      );
    }

    const { data: expenses, error: expensesError } = await query;

    if (expensesError) {
      console.error("Supabase query error:", expensesError);
      return NextResponse.json(
        { error: `Failed to fetch expenses: ${expensesError.message}` },
        { status: 500 }
      );
    }

    // If we have expenses, fetch the associated user profiles
    let expensesWithUsers = expenses || [];
    if (expenses && expenses.length > 0) {
      const userIds = [...new Set(expenses.map((expense) => expense.user_id))];

      try {
        // Get user profiles
        const { data: userProfiles, error: userError } = await supabase
          .from("user_profiles")
          .select("id, full_name")
          .in("id", userIds);

        // Get auth users data using Admin API
        const adminSupabase = createAdminSupabaseClient();
        const { data: authUsersResponse, error: authError } =
          await adminSupabase.auth.admin.listUsers();

        if (userError) {
          console.error("Error fetching user profiles:", userError);
        }

        if (authError) {
          console.error("Error fetching auth users:", authError);
        }

        // Filter auth users to only include those we need
        const authUsers =
          authUsersResponse?.users?.filter((user) =>
            userIds.includes(user.id)
          ) || [];

        // Join the user profiles with expenses
        expensesWithUsers = expenses.map((expense) => {
          const userProfile = userProfiles?.find(
            (user) => user.id === expense.user_id
          );
          const authUser = authUsers?.find(
            (user) => user.id === expense.user_id
          );

          return {
            ...expense,
            user_profiles: userProfile
              ? {
                  ...userProfile,
                  email: authUser?.email,
                }
              : null,
          };
        });
      } catch (error) {
        console.error("Error fetching user data:", error);
        // Continue without user data rather than failing completely
      }
    }

    // Return only real expenses from the database

    return NextResponse.json({
      expenses: expensesWithUsers,
      total: expensesWithUsers.length,
    });
  } catch (error) {
    console.error("Error fetching expenses:", error);
    return NextResponse.json(
      { error: "Failed to fetch expenses" },
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

    const body: ExpenseCreate = await request.json();

    // Validate required fields
    if (
      !body.title ||
      typeof body.amount !== "number" ||
      (!body.category && !body.category_id) ||
      !body.expense_date
    ) {
      return NextResponse.json(
        {
          error:
            "Title, amount, category, and expense date are required fields",
        },
        { status: 400 }
      );
    }

    // Validate amount
    if (body.amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 }
      );
    }

    // Handle category_id and category relationship
    let categoryId = body.category_id;
    let categoryName = body.category;

    // If only category_id is provided, get the category data
    if (categoryId && !categoryName) {
      const { data: categoryData } = await supabase
        .from("expense_categories")
        .select("name, is_system")
        .eq("id", categoryId)
        .eq("is_active", true)
        .single();

      if (categoryData) {
        // For system categories, use the actual name
        // For custom categories, use "other" to satisfy the enum constraint
        categoryName = categoryData.is_system ? categoryData.name : "other";
      }
    }

    // If only category name is provided, get the category_id
    if (!categoryId && categoryName) {
      const { data: categoryData } = await supabase
        .from("expense_categories")
        .select("id")
        .eq("name", categoryName)
        .eq("is_active", true)
        .single();

      categoryId = categoryData?.id;
    }

    // Prepare data for insertion
    const expenseData = {
      title: body.title,
      description: body.description || null,
      amount: body.amount,
      category: categoryName,
      category_id: categoryId,
      priority: body.priority || "medium",
      expense_date: body.expense_date,
      vendor: body.vendor || null,
      payment_method: body.payment_method,
      receipt_url: body.receipt_url || null,
      notes: body.notes || null,
      tags: body.tags || [],
      user_id: auth.userId,
      status: "pending",
    };

    const { data, error } = await supabase
      .from("expenses")
      .insert([expenseData])
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { error: `Failed to create expense: ${error.message}` },
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
    console.error("Error creating expense:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
