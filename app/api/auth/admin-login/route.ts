import { NextRequest, NextResponse } from 'next/server';
import { loginAdmin, setSessionCookie } from '@/lib/admin-auth';
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limit';

const MAX_LOGIN_ATTEMPTS = 5;
const WINDOW_SECONDS = 300; // 5 minutes

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

    // Rate limit by IP + identifier combo
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateLimitKey = `login:${ip}:${identifier}`;

    const rateLimit = await checkRateLimit(rateLimitKey, MAX_LOGIN_ATTEMPTS, WINDOW_SECONDS);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: `Too many login attempts. Please try again in ${rateLimit.retryAfterSeconds} seconds.` },
        { status: 429 }
      );
    }

    const result = await loginAdmin(identifier, password);

    if (!result.success || !result.token) {
      return NextResponse.json(
        { error: result.error || 'Login failed' },
        { status: 401 }
      );
    }

    // Successful login — reset rate limit counter
    await resetRateLimit(rateLimitKey);

    // Set HttpOnly session cookie
    await setSessionCookie(result.token);

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
