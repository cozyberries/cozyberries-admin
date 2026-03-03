import { sign, verify } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createAdminSupabaseClient } from './supabase-server';
import { cookies } from 'next/headers';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
}
const COOKIE_NAME = 'admin_session';
const BCRYPT_SALT_ROUNDS = 12;
const TOKEN_EXPIRY = '24h';

// ---- Types ----

export interface AdminUser {
  id: string;
  username: string;
  email: string | null;
  full_name: string | null;
  role: 'admin' | 'super_admin';
  is_active: boolean;
}

export interface AdminTokenPayload {
  id: string;
  username: string;
  email?: string;
  role: 'admin' | 'super_admin';
  isAnonymous: false;
  iat?: number;
  exp?: number;
}

// ---- Password Hashing ----

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ---- JWT Token Management ----

export function generateAdminJWT(admin: AdminUser): string {
  const payload: AdminTokenPayload = {
    id: admin.id,
    username: admin.username,
    email: admin.email || undefined,
    role: admin.role,
    isAnonymous: false,
  };
  return sign(payload, getJwtSecret(), {
    expiresIn: TOKEN_EXPIRY,
    issuer: 'cozyberries-admin',
    audience: 'cozyberries-admin-panel',
  });
}

export function verifyAdminJWT(token: string): AdminTokenPayload {
  return verify(token, getJwtSecret(), {
    issuer: 'cozyberries-admin',
    audience: 'cozyberries-admin-panel',
  }) as unknown as AdminTokenPayload;
}

// ---- Cookie Management ----

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 24 * 60 * 60, // 24 hours
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
}

export async function getSessionFromCookie(): Promise<AdminTokenPayload | null> {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(COOKIE_NAME);
    if (!cookie?.value) return null;
    return verifyAdminJWT(cookie.value);
  } catch {
    return null;
  }
}

// ---- Login ----

export async function loginAdmin(identifier: string, password: string): Promise<{
  success: boolean;
  admin?: AdminUser;
  token?: string;
  error?: string;
}> {
  const supabase = createAdminSupabaseClient();

  // Look up by username OR email
  const isEmail = identifier.includes('@');
  const column = isEmail ? 'email' : 'username';

  const { data: admin, error } = await supabase
    .from('admin_users')
    .select('id, username, email, full_name, role, is_active, password_hash')
    .eq(column, identifier)
    .single();

  if (error || !admin) {
    return { success: false, error: 'Invalid credentials' };
  }

  if (!admin.is_active) {
    return { success: false, error: 'Invalid credentials' };
  }

  const isValid = await verifyPassword(password, admin.password_hash);
  if (!isValid) {
    return { success: false, error: 'Invalid credentials' };
  }

  // Update last_login_at
  await supabase
    .from('admin_users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', admin.id);

  const adminUser: AdminUser = {
    id: admin.id,
    username: admin.username,
    email: admin.email,
    full_name: admin.full_name,
    role: admin.role,
    is_active: admin.is_active,
  };

  const token = generateAdminJWT(adminUser);

  return { success: true, admin: adminUser, token };
}

// ---- Create Admin ----

export async function createAdmin(data: {
  username: string;
  password: string;
  email?: string;
  full_name?: string;
  role?: 'admin' | 'super_admin';
  created_by?: string;
}): Promise<{ success: boolean; admin?: AdminUser; error?: string }> {
  // Validate password
  if (data.password.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters' };
  }

  const supabase = createAdminSupabaseClient();
  const password_hash = await hashPassword(data.password);

  const { data: admin, error } = await supabase
    .from('admin_users')
    .insert({
      username: data.username,
      password_hash,
      email: data.email || null,
      full_name: data.full_name || null,
      role: data.role || 'admin',
      created_by: data.created_by || null,
    })
    .select('id, username, email, full_name, role, is_active')
    .single();

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'Username or email already exists' };
    }
    return { success: false, error: error.message };
  }

  return { success: true, admin: admin as AdminUser };
}
