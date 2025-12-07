import { sign, verify, JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { createAdminSupabaseClient } from './supabase-server';

// JWT secret key - in production, use a strong secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

export interface UserPayload {
  id: string;
  email?: string;
  role: 'customer' | 'admin' | 'super_admin';
  isAnonymous: boolean;
  sessionId?: string;
}

export interface AnonymousUserPayload {
  id: string;
  role: 'customer';
  isAnonymous: true;
  sessionId: string;
  createdAt: string;
}

/**
 * Generate JWT token for authenticated user
 */
export async function generateAuthToken(userId: string, userEmail?: string): Promise<string> {
  try {
    const supabase = createAdminSupabaseClient();
    
    // Get user profile with role
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', userId)
      .single();

    const userRole = profile?.role || 'customer';

    // If email is not provided, try to get it from auth
    let email = userEmail;
    if (!email) {
      const { data: authUser } = await supabase.auth.admin.getUserById(userId);
      email = authUser.user?.email;
    }

    const payload: UserPayload = {
      id: userId,
      email: email,
      role: userRole,
      isAnonymous: false,
    };

    return sign(payload, JWT_SECRET, {
      expiresIn: '7d', // Token expires in 7 days
      issuer: 'your-app-name',
      audience: 'your-app-users',
    });
  } catch (error) {
    console.error('Error generating auth token:', error);
    throw new Error('Failed to generate authentication token');
  }
}

/**
 * Generate JWT token for anonymous user
 */
export function generateAnonymousToken(): string {
  const anonymousId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const payload: AnonymousUserPayload = {
    id: anonymousId,
    role: 'customer',
    isAnonymous: true,
    sessionId,
    createdAt: new Date().toISOString(),
  };

  return sign(payload, JWT_SECRET, {
    expiresIn: '30d', // Anonymous tokens last longer
    issuer: 'your-app-name',
    audience: 'your-app-anonymous',
  });
}

/**
 * Verify and decode JWT token
 */
export function verifyToken(token: string): UserPayload | AnonymousUserPayload {
  try {
    const decoded = verify(token, JWT_SECRET) as UserPayload | AnonymousUserPayload;
    return decoded;
  } catch (error) {
    if (error instanceof JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    if (error instanceof TokenExpiredError) {
      throw new Error('Token expired');
    }
    throw new Error('Token verification failed');
  }
}

/**
 * Extract token from request headers
 */
export function extractTokenFromHeaders(headers: Headers): string | null {
  const authHeader = headers.get('authorization');
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;

  return parts[1];
}

/**
 * Check if user is admin based on token
 */
export function isAdminUser(user: UserPayload | AnonymousUserPayload): boolean {
  return !user.isAnonymous && ['admin', 'super_admin'].includes(user.role);
}

/**
 * Check if user is super admin based on token
 */
export function isSuperAdminUser(user: UserPayload | AnonymousUserPayload): boolean {
  return !user.isAnonymous && user.role === 'super_admin';
}

/**
 * Middleware function to authenticate requests
 */
export async function authenticateRequest(request: Request): Promise<{
  user: UserPayload | AnonymousUserPayload;
  userId?: string;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}> {
  const token = extractTokenFromHeaders(request.headers);
  
  if (!token) {
    // Generate anonymous token for unauthenticated requests
    const anonymousToken = generateAnonymousToken();
    const anonymousUser = verifyToken(anonymousToken) as AnonymousUserPayload;
    
    return {
      user: anonymousUser,
      userId: undefined,
      isAuthenticated: false,
      isAdmin: false,
      isSuperAdmin: false,
    };
  }

  try {
    const user = verifyToken(token);
    return {
      user,
      userId: user.isAnonymous ? undefined : user.id,
      isAuthenticated: !user.isAnonymous,
      isAdmin: isAdminUser(user),
      isSuperAdmin: isSuperAdminUser(user),
    };
  } catch (error) {
    // If token is invalid, treat as anonymous
    const anonymousToken = generateAnonymousToken();
    const anonymousUser = verifyToken(anonymousToken) as AnonymousUserPayload;
    
    return {
      user: anonymousUser,
      userId: undefined,
      isAuthenticated: false,
      isAdmin: false,
      isSuperAdmin: false,
    };
  }
}

/**
 * Create admin user token (for initial setup)
 */
export function generateAdminToken(userId: string, email: string): string {
  const payload: UserPayload = {
    id: userId,
    email,
    role: 'admin',
    isAnonymous: false,
  };

  return sign(payload, JWT_SECRET, {
    expiresIn: '7d',
    issuer: 'your-app-name',
    audience: 'your-app-users',
  });
}

/**
 * Create super admin user token (for initial setup)
 */
export function generateSuperAdminToken(userId: string, email: string): string {
  const payload: UserPayload = {
    id: userId,
    email,
    role: 'super_admin',
    isAnonymous: false,
  };

  return sign(payload, JWT_SECRET, {
    expiresIn: '7d',
    issuer: 'your-app-name',
    audience: 'your-app-users',
  });
}
