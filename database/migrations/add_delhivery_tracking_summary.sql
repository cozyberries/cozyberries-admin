-- Add Delhivery tracking summary columns to orders table
-- These store only the latest status snapshot (not full scan history).
-- Applied via Supabase Dashboard SQL Editor or: supabase db execute --file database/migrations/add_delhivery_tracking_summary.sql

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delhivery_latest_status    TEXT,
  ADD COLUMN IF NOT EXISTS delhivery_latest_scan_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delhivery_latest_location  TEXT;
