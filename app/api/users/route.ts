import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-server";
import { authenticateRequest } from "@/lib/jwt-auth";

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
    const search = searchParams.get("search") || "";

    // When a search term is provided, query user_profiles directly
    if (search) {
      const { data: profileResults, error: profileSearchError } = await supabase
        .from("user_profiles")
        .select("id, full_name, email, phone, role, is_active, is_verified, admin_notes")
        .or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)
        .limit(limit);

      if (profileSearchError) {
        console.error("Error searching user profiles:", profileSearchError);
        return NextResponse.json({ error: "Failed to search users" }, { status: 500 });
      }

      const matchingProfiles = profileResults || [];
      const matchingIds = matchingProfiles.map((p) => p.id);

      const { data: orderStats } = matchingIds.length
        ? await supabase.from("orders").select("user_id, total_amount").in("user_id", matchingIds)
        : { data: [] };

      const statsMap = new Map<string, { order_count: number; total_spent: number }>();
      orderStats?.forEach((order) => {
        if (!statsMap.has(order.user_id)) statsMap.set(order.user_id, { order_count: 0, total_spent: 0 });
        const s = statsMap.get(order.user_id)!;
        s.order_count += 1;
        s.total_spent += order.total_amount || 0;
      });

      const users = matchingProfiles.map((profile) => {
        const stats = statsMap.get(profile.id) || { order_count: 0, total_spent: 0 };
        return {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          phone: profile.phone,
          role: profile.role || "customer",
          is_active: profile.is_active ?? true,
          is_verified: profile.is_verified ?? false,
          admin_notes: profile.admin_notes,
          order_count: stats.order_count,
          total_spent: stats.total_spent,
        };
      });

      return NextResponse.json({
        users,
        total: users.length,
        pagination: { page: Math.floor(offset / limit) + 1, perPage: limit, total: users.length },
      });
    }

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
      phone: user.phone,
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
        full_name: profile?.full_name || authUser.raw_user_meta_data?.full_name,
        phone: profile?.phone || authUser.phone,
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

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.isAuthenticated || !auth.isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const supabase = createAdminSupabaseClient();
    const body = await request.json();

    // Phone is required and must be E.164
    if (!body.phone || typeof body.phone !== "string") {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }
    const rawPhone = body.phone.trim();
    const phone = rawPhone.startsWith("+") ? rawPhone : `+${rawPhone}`;
    if (!/^\+[1-9]\d{1,14}$/.test(phone)) {
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
    }

    // Create Supabase Auth user
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      phone,
      email: body.email || undefined,
      phone_confirm: true,
      ...(body.email ? { email_confirm: true } : {}),
      user_metadata: {
        ...(body.full_name ? { full_name: body.full_name } : {}),
      },
    });

    if (createError) {
      return NextResponse.json(
        { error: `Failed to create user: ${createError.message}` },
        { status: 500 }
      );
    }

    // Insert user profile; rollback auth user if this fails
    const { error: profileError } = await supabase.from("user_profiles").insert({
      id: newUser.user.id,
      phone,
      email: body.email || null,
      full_name: body.full_name || null,
      role: "customer",
      is_active: true,
      is_verified: false,
    });

    if (profileError) {
      console.error("Failed to create user profile, rolling back auth user:", profileError);
      await supabase.auth.admin.deleteUser(newUser.user.id);
      return NextResponse.json(
        { error: `Failed to create user: ${profileError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        user: {
          id: newUser.user.id,
          email: body.email || null,
          phone,
          full_name: body.full_name || null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
