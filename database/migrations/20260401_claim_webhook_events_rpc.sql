CREATE OR REPLACE FUNCTION public.claim_webhook_events(
  p_batch_size      INT,
  p_lease_threshold TIMESTAMPTZ,
  p_now             TIMESTAMPTZ
)
RETURNS SETOF public.webhook_events
LANGUAGE sql
AS $$
  UPDATE public.webhook_events
  SET status = 'processing', updated_at = p_now
  WHERE id IN (
    SELECT id FROM public.webhook_events
    WHERE (
      (status = 'pending' AND (next_retry_at IS NULL OR next_retry_at <= p_now))
      OR (status = 'failed' AND next_retry_at IS NOT NULL AND next_retry_at <= p_now)
      OR (status = 'processing' AND updated_at <= p_lease_threshold)
    )
    ORDER BY created_at ASC
    LIMIT LEAST(GREATEST(COALESCE(p_batch_size, 0), 1), 500)
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;

GRANT EXECUTE ON FUNCTION public.claim_webhook_events(INT, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
