import { NextResponse } from 'next/server';
import { getSessionFromCookie, generateAdminJWT } from '@/lib/admin-auth';
import type { AdminUser } from '@/lib/admin-auth';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

function isValidAdminUser(obj: unknown): obj is AdminUser {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.username === 'string' &&
    (o.email === null || typeof o.email === 'string') &&
    (o.full_name === null || typeof o.full_name === 'string') &&
    (o.role === 'admin' || o.role === 'super_admin') &&
    typeof o.is_active === 'boolean'
  );
}

export async function GET() {
  try {
    const session = await getSessionFromCookie();

    if (!session) {
      return NextResponse.json(
        { authenticated: false },
        { status: 401 }
      );
    }

    // Fetch fresh admin data from DB to verify account is still active
    const supabase = createAdminSupabaseClient();
    const { data: admin } = await supabase
      .from('admin_users')
      .select('id, username, email, full_name, role, is_active')
      .eq('id', session.id)
      .eq('is_active', true)
      .single();

    if (!admin) {
      return NextResponse.json(
        { authenticated: false, error: 'Admin not found or deactivated' },
        { status: 401 }
      );
    }

    if (!isValidAdminUser(admin)) {
      console.error('Admin record has unexpected shape:', Object.keys(admin));
      return NextResponse.json(
        { authenticated: false, error: 'Invalid admin record' },
        { status: 500 }
      );
    }

    // Generate a fresh token for the client (needed by useAuthenticatedFetch Bearer header)
    const token = generateAdminJWT(admin);

    return NextResponse.json({
      authenticated: true,
      user: admin,
      token,
    });
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json(
      { authenticated: false },
      { status: 401 }
    );
  }
}
