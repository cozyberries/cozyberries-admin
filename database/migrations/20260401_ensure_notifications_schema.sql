CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        NOT NULL,
  title       TEXT        NOT NULL,
  message     TEXT        NOT NULL,
  type        TEXT        NOT NULL DEFAULT 'shipping_scan',
  read        BOOLEAN     NOT NULL DEFAULT false,
  meta        JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- If `notifications` already existed (e.g. older stub), CREATE TABLE above is skipped and
-- columns like user_id may be missing. Add core columns before indexes and NOT NULL steps.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS message TEXT;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'shipping_scan',
  ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS meta JSONB,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.notifications
SET
  type = COALESCE(type, 'shipping_scan'),
  read = COALESCE(read, false),
  created_at = COALESCE(created_at, NOW()),
  updated_at = COALESCE(updated_at, NOW())
WHERE
  type IS NULL
  OR read IS NULL
  OR created_at IS NULL
  OR updated_at IS NULL;

ALTER TABLE public.notifications
  ALTER COLUMN type SET DEFAULT 'shipping_scan',
  ALTER COLUMN type SET NOT NULL,
  ALTER COLUMN read SET DEFAULT false,
  ALTER COLUMN read SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
  ON public.notifications (user_id, read, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notifications_updated_at ON public.notifications;
DROP TRIGGER IF EXISTS trg_notifications_set_updated_at ON public.notifications;
CREATE TRIGGER trg_notifications_set_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_notifications_updated_at();

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON public.notifications;
CREATE POLICY "Service role full access" ON public.notifications
  FOR ALL TO service_role USING (true) WITH CHECK (true);
REVOKE ALL ON public.notifications FROM anon, authenticated;
GRANT ALL ON public.notifications TO service_role;
