-- Migration: Backfill meta for legacy notifications from orders table
-- Legacy notifications have meta = NULL and carry the customer identifier
-- embedded in the message text as: "{customer_email} {action phrase}"
--
-- Known action phrase prefixes:
--   "order created"            → Order Created
--   "order successfully"       → Order Success
--   "order confirmed"          → Order Success (UPI)
--   "has placed an order"      → Order Placed
--   "checkout session failed"  → Checkout Failed
--   "order failed"             → Order Failed

WITH notification_customer AS (
  SELECT
    n.id,
    n.created_at,
    n.title,
    -- Extract the customer identifier: everything before the first action keyword
    CASE
      WHEN n.message LIKE '% order created%'          THEN SPLIT_PART(n.message, ' order created',   1)
      WHEN n.message LIKE '% order successfully%'     THEN SPLIT_PART(n.message, ' order successfully', 1)
      WHEN n.message LIKE '% order confirmed%'        THEN SPLIT_PART(n.message, ' order confirmed', 1)
      WHEN n.message LIKE '% has placed an order%'    THEN SPLIT_PART(n.message, ' has placed',       1)
      WHEN n.message LIKE '% checkout session%'       THEN SPLIT_PART(n.message, ' checkout session', 1)
      WHEN n.message LIKE '% order failed%'           THEN SPLIT_PART(n.message, ' order failed',     1)
      ELSE NULL
    END AS customer_identifier
  FROM notifications n
  WHERE n.meta IS NULL
    AND n.message IS NOT NULL
),
-- For each notification pick the temporally nearest order for that customer
best_match AS (
  SELECT DISTINCT ON (nc.id)
    nc.id                                          AS notification_id,
    o.id                                           AS order_id,
    o.order_number,
    o.customer_email,
    o.tracking_number,
    o.status,
    o.shipping_address->>'full_name'               AS customer_name
  FROM notification_customer nc
  JOIN orders o ON o.customer_email = nc.customer_identifier
  WHERE nc.customer_identifier IS NOT NULL
    AND nc.customer_identifier <> ''
  ORDER BY
    nc.id,
    ABS(EXTRACT(EPOCH FROM (o.created_at - nc.created_at))) ASC
)
UPDATE notifications n
SET meta = jsonb_strip_nulls(jsonb_build_object(
  'lifecycle_event',  'legacy_backfill',
  'order_id',         bm.order_id::text,
  'order_number',     bm.order_number,
  'customer_email',   bm.customer_email,
  'customer_name',    NULLIF(TRIM(bm.customer_name), ''),
  'order_status',     bm.status,
  'awb',              NULLIF(TRIM(bm.tracking_number), '')
))
FROM best_match bm
WHERE n.id = bm.notification_id;

-- Report how many rows were updated
DO $$
DECLARE
  updated_count integer;
BEGIN
  SELECT COUNT(*) INTO updated_count FROM notifications WHERE meta IS NOT NULL;
  RAISE NOTICE 'notifications with meta after backfill: %', updated_count;
END $$;
