import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-server";
import { createAdmin, generateAdminJWT, setSessionCookie } from "@/lib/admin-auth";

// This endpoint is used for initial admin setup
// Protected with a setup key - disabled after first admin is created
export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error("Invalid JSON in request body:", parseError);
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const { username, password, email, setupKey } = body;

    // Verify setup key
    const expectedSetupKey = process.env.ADMIN_SETUP_KEY || 'super-secret-setup-key-change-this';
    if (setupKey !== expectedSetupKey) {
      return NextResponse.json(
        { error: "Invalid setup key" },
        { status: 401 }
      );
    }

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    // Verify no admin users exist yet (prevent duplicate setup)
    const supabase = createAdminSupabaseClient();
    const { data: existingAdmins } = await supabase
      .from('admin_users')
      .select('id')
      .limit(1);

    if (existingAdmins && existingAdmins.length > 0) {
      return NextResponse.json(
        { error: "Setup already completed. An admin user already exists." },
        { status: 409 }
      );
    }

    // Create admin in admin_users table
    const result = await createAdmin({
      username,
      password,
      email: email || undefined,
      full_name: 'Administrator',
      role: 'super_admin',
    });

    if (!result.success) {
      console.error("Failed to create admin user:", result.error);
      return NextResponse.json(
        { error: "Failed to create admin user" },
        { status: 500 }
      );
    }

    if (!result.admin) {
      return NextResponse.json(
        { error: "Admin user creation returned no data" },
        { status: 500 }
      );
    }

    // Generate JWT and set session cookie
    const token = generateAdminJWT(result.admin);
    await setSessionCookie(token);

    return NextResponse.json({
      message: "Admin user created successfully",
      user: {
        id: result.admin.id,
        username: result.admin.username,
        email: result.admin.email,
        role: 'super_admin'
      },
      token
    });

  } catch (error) {
    console.error("Error in admin setup:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Get admin setup status
export async function GET() {
  try {
    const supabase = createAdminSupabaseClient();

    // Check if any admin users exist in admin_users table
    const { data: adminUsers, error } = await supabase
      .from('admin_users')
      .select('id')
      .limit(1);

    if (error) {
      return NextResponse.json(
        { error: "Failed to check admin status" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      hasAdminUsers: (adminUsers?.length || 0) > 0,
      needsSetup: (adminUsers?.length || 0) === 0
    });

  } catch (error) {
    console.error("Error checking admin setup:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
