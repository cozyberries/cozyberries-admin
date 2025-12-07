import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-server";
import { generateSuperAdminToken } from "@/lib/jwt-auth";

// This endpoint is used for initial admin setup
// In production, this should be protected with a setup key or disabled after first use
export async function POST(request: NextRequest) {
  try {
    const { email, password, setupKey } = await request.json();

    // Verify setup key (use environment variable for security)
    const expectedSetupKey = process.env.ADMIN_SETUP_KEY || 'super-secret-setup-key-change-this';
    if (setupKey !== expectedSetupKey) {
      return NextResponse.json(
        { error: "Invalid setup key" },
        { status: 401 }
      );
    }

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Use admin client to create user
    const supabase = createAdminSupabaseClient();
    
    // Create the user in auth.users
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email for admin users
      user_metadata: {
        full_name: 'Administrator',
        role: 'super_admin'
      }
    });

    if (authError || !authUser.user) {
      console.error('Error creating admin user:', authError);
      return NextResponse.json(
        { error: "Failed to create admin user: " + (authError?.message || 'Unknown error') },
        { status: 500 }
      );
    }

    // Create or update user profile with admin role
    const { error: profileError } = await supabase
      .from('user_profiles')
      .upsert({
        id: authUser.user.id,
        role: 'super_admin',
        full_name: 'Administrator',
        is_active: true,
        is_verified: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (profileError) {
      console.error('Error creating admin profile:', profileError);
      // Try to delete the auth user if profile creation failed
      await supabase.auth.admin.deleteUser(authUser.user.id);
      return NextResponse.json(
        { error: "Failed to create admin profile: " + profileError.message },
        { status: 500 }
      );
    }

    // Generate JWT token for the admin user
    const adminToken = generateSuperAdminToken(authUser.user.id, email);

    return NextResponse.json({
      message: "Admin user created successfully",
      user: {
        id: authUser.user.id,
        email: authUser.user.email,
        role: 'super_admin'
      },
      token: adminToken
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
    
    // Check if any admin users exist
    const { data: adminUsers, error } = await supabase
      .from('user_profiles')
      .select('id')
      .in('role', ['admin', 'super_admin'])
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
