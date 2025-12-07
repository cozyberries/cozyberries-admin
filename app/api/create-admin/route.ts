import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-server";
import { authenticateRequest, isSuperAdminUser } from "@/lib/jwt-auth";

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

    const { email, password, role = 'admin', fullName } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (!['admin', 'super_admin'].includes(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be 'admin' or 'super_admin'" },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();
    
    // Create the user in auth.users
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName || 'Admin User',
        role: role
      }
    });

    if (authError || !authUser.user) {
      console.error('Error creating admin user:', authError);
      return NextResponse.json(
        { error: "Failed to create admin user: " + (authError?.message || 'Unknown error') },
        { status: 500 }
      );
    }

    // Create user profile with admin role
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: authUser.user.id,
        role: role,
        full_name: fullName || 'Admin User',
        is_active: true,
        is_verified: true,
        created_by: auth.user.id, // Track who created this admin
        admin_notes: `Created by ${!auth.user.isAnonymous ? auth.user.email || 'super admin' : 'super admin'} on ${new Date().toISOString()}`
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

    return NextResponse.json({
      message: "Admin user created successfully",
      user: {
        id: authUser.user.id,
        email: authUser.user.email,
        role: role,
        fullName: fullName || 'Admin User'
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
    
    // Get all admin users with their profiles
    const { data: adminUsers, error } = await supabase
      .from('user_profiles')
      .select(`
        id,
        role,
        full_name,
        is_active,
        is_verified,
        admin_notes,
        created_by,
        created_at,
        updated_at
      `)
      .in('role', ['admin', 'super_admin'])
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch admin users" },
        { status: 500 }
      );
    }

    // Get auth user details for each admin
    const adminUsersWithAuth = await Promise.all(
      (adminUsers || []).map(async (profile) => {
        const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
        return {
          ...profile,
          email: authUser.user?.email,
          last_sign_in_at: authUser.user?.last_sign_in_at,
          email_confirmed_at: authUser.user?.email_confirmed_at
        };
      })
    );

    return NextResponse.json({
      adminUsers: adminUsersWithAuth,
      total: adminUsersWithAuth.length
    });

  } catch (error) {
    console.error("Error fetching admin users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
