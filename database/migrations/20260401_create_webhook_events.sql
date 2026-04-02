CREATE TABLE IF NOT EXISTS public.webhook_events (
  id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source          TEXT        NOT NULL DEFAULT 'delhivery',
  event_type      TEXT        NOT NULL DEFAULT 'shipment_scan',
  awb             TEXT,
  payload         JSONB       NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
  attempt_count   INT         NOT NULL DEFAULT 0,
  next_retry_at   TIMESTAMPTZ,
  last_error      TEXT,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_status_retry
  ON public.webhook_events (status, next_retry_at, created_at);

CREATE INDEX IF NOT EXISTS idx_webhook_events_processing_reclaim
  ON public.webhook_events (updated_at, created_at, id)
  WHERE status = 'processing';

CREATE INDEX IF NOT EXISTS idx_webhook_events_awb
  ON public.webhook_events (awb, created_at DESC)
  WHERE awb IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_webhook_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_webhook_events_updated_at ON public.webhook_events;
DROP TRIGGER IF EXISTS trg_webhook_events_set_updated_at ON public.webhook_events;
CREATE TRIGGER trg_webhook_events_set_updated_at
  BEFORE UPDATE ON public.webhook_events
  FOR EACH ROW EXECUTE FUNCTION public.set_webhook_events_updated_at();

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON public.webhook_events;
CREATE POLICY "Service role full access" ON public.webhook_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);
REVOKE ALL ON public.webhook_events FROM anon, authenticated;
GRANT ALL ON public.webhook_events TO service_role;
