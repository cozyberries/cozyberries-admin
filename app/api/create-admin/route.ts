import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-server";
import { authenticateRequest, isSuperAdminUser } from "@/lib/jwt-auth";
import { createAdmin } from "@/lib/admin-auth";

// Create new admin user (only accessible by super admins)
export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const auth = await authenticateRequest(request);

    if (!auth.isAuthenticated || !isSuperAdminUser(auth.user)) {
      return NextResponse.json(
        { error: "Super admin access required" },
        { status: 403 }
      );
    }

    const { username, password, email, role = 'admin', fullName } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    if (!['admin', 'super_admin'].includes(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be 'admin' or 'super_admin'" },
        { status: 400 }
      );
    }

    // Create admin in admin_users table
    const result = await createAdmin({
      username,
      password,
      email: email || undefined,
      full_name: fullName || 'Admin User',
      role,
      created_by: auth.user.id,
    });

    if (!result.success) {
      console.error("Failed to create admin user:", result.error);
      return NextResponse.json(
        { error: "Failed to create admin user" },
        { status: 500 }
      );
    }

    if (!result.admin) {
      console.error("createAdmin returned success but no admin object");
      return NextResponse.json(
        { error: "Failed to create admin user" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Admin user created successfully",
      user: {
        id: result.admin.id,
        username: result.admin.username,
        email: result.admin.email,
        role: result.admin.role,
        fullName: result.admin.full_name,
      }
    });

  } catch (error) {
    console.error("Error creating admin user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Get all admin users (only accessible by super admins)
export async function GET(request: NextRequest) {
  try {
    // Authenticate the request
    const auth = await authenticateRequest(request);

    if (!auth.isAuthenticated || !isSuperAdminUser(auth.user)) {
      return NextResponse.json(
        { error: "Super admin access required" },
        { status: 403 }
      );
    }

    const supabase = createAdminSupabaseClient();

    // Get all admin users directly from admin_users table
    const { data: adminUsers, error } = await supabase
      .from('admin_users')
      .select(`
        id,
        username,
        email,
        full_name,
        role,
        is_active,
        last_login_at,
        created_by,
        created_at,
        updated_at
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch admin users" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      adminUsers: adminUsers || [],
      total: adminUsers?.length || 0
    });

  } catch (error) {
    console.error("Error fetching admin users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
