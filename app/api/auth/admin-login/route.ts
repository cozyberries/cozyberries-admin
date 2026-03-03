import { NextRequest, NextResponse } from 'next/server';
import { loginAdmin, setSessionCookie } from '@/lib/admin-auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { identifier, password } = body;

    if (!identifier || !password) {
      return NextResponse.json(
        { error: 'Username/email and password are required' },
        { status: 400 }
      );
    }

    const result = await loginAdmin(identifier, password);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 401 }
      );
    }

    // Set HttpOnly session cookie
    await setSessionCookie(result.token!);

    return NextResponse.json({
      user: result.admin,
      token: result.token,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
