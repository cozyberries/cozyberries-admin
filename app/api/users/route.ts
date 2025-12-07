import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-server";
import { authenticateRequest, isAdminUser } from "@/lib/jwt-auth";

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

    // Use service role client to bypass RLS and access auth.users directly
    const supabase = createAdminSupabaseClient();

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Fetch auth.users data directly using service role
    const { data: authUsers, error: authUsersError } = await supabase.auth.admin.listUsers({
      page: Math.floor(offset / limit) + 1,
      perPage: limit,
    });

    if (authUsersError) {
      console.error("Error fetching auth users:", authUsersError);
      return NextResponse.json(
        { error: "Failed to fetch users: " + authUsersError.message },
        { status: 500 }
      );
    }

    // Map the auth users to the expected format
    const formattedAuthUsers = authUsers.users.map(user => ({
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      email_confirmed_at: user.email_confirmed_at,
      updated_at: user.updated_at,
      raw_user_meta_data: user.user_metadata,
      is_super_admin: user.user_metadata?.is_super_admin || false,
      aud: user.aud,
      role: user.role,
    }));

    // Get user profiles to combine with auth data
    const userIds = formattedAuthUsers.map((user) => user.id);
    const { data: profiles, error: profilesError } = await supabase
      .from("user_profiles")
      .select("*")
      .in("id", userIds);

    if (profilesError) {
      console.error("Error fetching user profiles:", profilesError);
      return NextResponse.json(
        { error: "Failed to fetch user profiles" },
        { status: 500 }
      );
    }

    // Get order statistics for each user
    const { data: orderStats, error: orderStatsError } = await supabase
      .from("orders")
      .select("user_id, total_amount")
      .in("user_id", userIds);

    if (orderStatsError) {
      console.error("Error fetching order stats:", orderStatsError);
    }

    // Create user statistics map
    const userStatsMap = new Map();
    orderStats?.forEach((order) => {
      const userId = order.user_id;
      if (!userStatsMap.has(userId)) {
        userStatsMap.set(userId, { order_count: 0, total_spent: 0 });
      }
      const stats = userStatsMap.get(userId);
      stats.order_count += 1;
      stats.total_spent += order.total_amount || 0;
    });

    // Combine all user data
    const users = formattedAuthUsers.map((authUser) => {
      const profile = profiles?.find((p) => p.id === authUser.id);
      const stats = userStatsMap.get(authUser.id) || {
        order_count: 0,
        total_spent: 0,
      };

      return {
        id: authUser.id,
        email: authUser.email,
        created_at: authUser.created_at,
        last_sign_in_at: authUser.last_sign_in_at,
        email_confirmed_at: authUser.email_confirmed_at,
        role: profile?.role || "customer",
        full_name: profile?.full_name,
        phone: profile?.phone,
        is_active: profile?.is_active ?? true,
        is_verified: profile?.is_verified ?? false,
        order_count: stats.order_count,
        total_spent: stats.total_spent,
        admin_notes: profile?.admin_notes,
      };
    });

    return NextResponse.json({
      users,
      total: authUsers.total || users.length,
      pagination: {
        page: Math.floor(offset / limit) + 1,
        perPage: limit,
        total: authUsers.total || users.length,
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
