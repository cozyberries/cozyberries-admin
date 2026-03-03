-- Migration: Create admin_users table for custom admin authentication
-- This table is completely separate from auth.users and user_profiles (customer-facing)

CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL
);

-- Index for username lookups (login)
CREATE INDEX IF NOT EXISTS idx_admin_users_username ON public.admin_users(username);

-- Index for email lookups (login)
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON public.admin_users(email) WHERE email IS NOT NULL;

-- Index for active users
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON public.admin_users(is_active) WHERE is_active = true;

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_admin_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_admin_users_updated_at ON public.admin_users;
CREATE TRIGGER trigger_admin_users_updated_at
  BEFORE UPDATE ON public.admin_users
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_users_updated_at();

-- RLS Policies: Only service_role can access admin_users
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Allow service_role full access
DROP POLICY IF EXISTS "Service role full access" ON public.admin_users;
CREATE POLICY "Service role full access" ON public.admin_users
  TO service_role
  FOR ALL USING (true) WITH CHECK (true);

-- Revoke all from anon and authenticated roles
REVOKE ALL ON public.admin_users FROM anon, authenticated;

-- Grant to service_role only
GRANT ALL ON public.admin_users TO service_role;
