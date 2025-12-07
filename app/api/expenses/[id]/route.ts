import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createAdminSupabaseClient,
} from "@/lib/supabase-server";
import { authenticateRequest } from "@/lib/jwt-auth";
import { ExpenseUpdate } from "@/lib/types/expense";

export async function GET(
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

    // First, get the expense with category data
    const { data: expense, error } = await supabase
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
      .eq("id", params.id)
      .single();

    if (error) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    // Fetch user profile and approver profile separately
    const userIds = [expense.user_id, expense.approved_by].filter(Boolean);
    let userProfiles: any[] = [];
    let authUsers: any[] = [];

    if (userIds.length > 0) {
      try {
        // Get user profiles
        const { data: profiles, error: profileError } = await supabase
          .from("user_profiles")
          .select("id, full_name")
          .in("id", userIds);

        // Get auth users data using Admin API
        const adminSupabase = createAdminSupabaseClient();
        const { data: authUsersResponse, error: authError } =
          await adminSupabase.auth.admin.listUsers();

        if (!profileError) {
          userProfiles = profiles || [];
        }

        if (!authError) {
          // Filter auth users to only include those we need
          authUsers =
            authUsersResponse?.users?.filter((user) =>
              userIds.includes(user.id)
            ) || [];
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    }

    // Add user profiles to the expense object
    const userProfile = userProfiles.find(
      (user) => user.id === expense.user_id
    );
    const approverProfile = userProfiles.find(
      (user) => user.id === expense.approved_by
    );
    const userAuth = authUsers.find((user) => user.id === expense.user_id);
    const approverAuth = authUsers.find(
      (user) => user.id === expense.approved_by
    );

    const expenseWithUsers = {
      ...expense,
      user_profiles: userProfile
        ? {
          ...userProfile,
          email: userAuth?.email,
        }
        : null,
      approver: approverProfile
        ? {
          ...approverProfile,
          email: approverAuth?.email,
        }
        : null,
    };

    return NextResponse.json(expenseWithUsers);
  } catch (error) {
    console.error("Error fetching expense:", error);
    return NextResponse.json(
      { error: "Failed to fetch expense" },
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

    const body: ExpenseUpdate = await request.json();

    // Validate amount if provided
    if (body.amount !== undefined && body.amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 }
      );
    }

    // Handle category updates
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

    // Prepare update data
    const updateData: any = { ...body };

    if (categoryId) {
      updateData.category_id = categoryId;
      updateData.category = categoryName;
    }

    if (body.status === "approved") {
      updateData.approved_by = auth.userId;
      updateData.approved_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("expenses")
      .update(updateData)
      .eq("id", params.id)
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
      .single();

    if (error) {
      return NextResponse.json(
        { error: `Failed to update expense: ${error.message}` },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    // Fetch user profiles for the updated expense
    const userIds = [data.user_id, data.approved_by].filter(Boolean);
    let userProfiles: any[] = [];
    let authUsers: any[] = [];

    if (userIds.length > 0) {
      try {
        // Get user profiles
        const { data: profiles, error: profileError } = await supabase
          .from("user_profiles")
          .select("id, full_name")
          .in("id", userIds);

        // Get auth users data using Admin API
        const adminSupabase = createAdminSupabaseClient();
        const { data: authUsersResponse, error: authError } =
          await adminSupabase.auth.admin.listUsers();

        if (!profileError) {
          userProfiles = profiles || [];
        }

        if (!authError) {
          // Filter auth users to only include those we need
          authUsers =
            authUsersResponse?.users?.filter((user) =>
              userIds.includes(user.id)
            ) || [];
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    }

    // Add user profiles to the expense object
    const userProfile = userProfiles.find((user) => user.id === data.user_id);
    const approverProfile = userProfiles.find(
      (user) => user.id === data.approved_by
    );
    const userAuth = authUsers.find((user) => user.id === data.user_id);
    const approverAuth = authUsers.find((user) => user.id === data.approved_by);

    const expenseWithUsers = {
      ...data,
      user_profiles: userProfile
        ? {
          ...userProfile,
          email: userAuth?.email,
        }
        : null,
      approver: approverProfile
        ? {
          ...approverProfile,
          email: approverAuth?.email,
        }
        : null,
    };

    return NextResponse.json(expenseWithUsers);
  } catch (error) {
    console.error("Error updating expense:", error);
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

    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", params.id);

    if (error) {
      return NextResponse.json(
        { error: `Failed to delete expense: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Expense deleted successfully" });
  } catch (error) {
    console.error("Error deleting expense:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
