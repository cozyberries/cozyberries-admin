import { NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/admin-auth';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

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

    return NextResponse.json({
      authenticated: true,
      user: admin,
    });
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json(
      { authenticated: false },
      { status: 401 }
    );
  }
}
