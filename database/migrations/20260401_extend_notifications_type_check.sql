-- Migration: Extend the notifications.type CHECK constraint to include
-- admin-generated notification types: order_status, payment_status, shipping_scan.
--
-- The original constraint only permitted: info, success, warning, error
-- (values used by the storefront app).  Our admin notification service
-- inserts order_status / payment_status / shipping_scan — previously all
-- silently rejected, so no new notifications were ever persisted.

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'info'::text,
    'success'::text,
    'warning'::text,
    'error'::text,
    'order_status'::text,
    'payment_status'::text,
    'shipping_scan'::text
  ]));
