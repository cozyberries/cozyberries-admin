# Delhivery Admin Notification System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ingest Delhivery webhook scan events durably and fan-out in-app notifications to all admin users, with retry/recovery guarantees so no scan events are silently dropped.

**Architecture:** A new `POST /api/webhooks/delhivery` route validates auth, writes raw payload to a `webhook_events` table, and returns `202` immediately. A cron-triggered worker (`POST /api/internal/webhooks/delhivery/process`) claims pending events, creates notification rows for all active admin users, and marks events processed with retry/backoff on failure. `GET /api/notifications` is wired to real DB data instead of the current stub.

**Tech Stack:** Next.js App Router (server routes only), Supabase (postgres + service-role), TanStack Query (existing), Tailwind + shadcn/ui (existing), Vercel cron.

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `database/migrations/20260401_create_webhook_events.sql` | Create `webhook_events` table + indexes |
| `database/migrations/20260401_ensure_notifications_schema.sql` | Create/ensure `notifications` table with correct columns |
| `lib/types/notifications.ts` | TypeScript types for `WebhookEvent`, `Notification`, `DelhiveryWebhookPayload` |
| `lib/services/delhivery-webhook.ts` | Parse Delhivery webhook payload → structured scans; validate payload shape |
| `lib/services/notification-service.ts` | Fan-out notification inserts; fetch admin recipients; retry backoff calculator |
| `lib/services/webhook-processor.ts` | Core processing loop: claim → process → update event status |
| `app/api/webhooks/delhivery/route.ts` | `POST` — validate token, persist event, return `202` |
| `app/api/internal/webhooks/delhivery/process/route.ts` | `POST` — cron-triggered worker, claims+processes batch |
| `app/api/admin/ops/webhook-events/metrics/route.ts` | `GET` — queue health metrics for ops visibility |
| `vercel.json` | Cron schedule definition |
| `database/migrations/20260401_claim_webhook_events_rpc.sql` | Postgres RPC for atomic batch claim with SKIP LOCKED |

### Modified files
| File | Change |
|------|--------|
| `app/api/notifications/route.ts` | Replace stub with real DB query + pagination |
| `app/api/notifications/[id]/route.ts` | Rewrite to use `authenticateRequest` + service-role client |
| `components/NotificationCenter.tsx` | Align `is_read` → `read` field, add type for `meta` |
| `env.template` | Add `DELHIVERY_WEBHOOK_TOKEN`, `INTERNAL_JOB_TOKEN` |
| `.env.test.example` | Add placeholder values |
| `tests/api.spec.ts` | Add webhook + notification endpoint tests |

---

## Task 1: Database Migrations

**Files:**
- Create: `database/migrations/20260401_create_webhook_events.sql`
- Create: `database/migrations/20260401_ensure_notifications_schema.sql`

- [ ] **Step 1: Write the `webhook_events` migration**

```sql
-- database/migrations/20260401_create_webhook_events.sql
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

CREATE INDEX IF NOT EXISTS idx_webhook_events_awb
  ON public.webhook_events (awb, created_at DESC)
  WHERE awb IS NOT NULL;

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_webhook_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_webhook_events_updated_at ON public.webhook_events;
CREATE TRIGGER trg_webhook_events_updated_at
  BEFORE UPDATE ON public.webhook_events
  FOR EACH ROW EXECUTE FUNCTION update_webhook_events_updated_at();

-- Service-role only
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON public.webhook_events;
CREATE POLICY "Service role full access" ON public.webhook_events
  TO service_role FOR ALL USING (true) WITH CHECK (true);
REVOKE ALL ON public.webhook_events FROM anon, authenticated;
GRANT ALL ON public.webhook_events TO service_role;
```

- [ ] **Step 2: Write the `notifications` migration**

```sql
-- database/migrations/20260401_ensure_notifications_schema.sql
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

CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
  ON public.notifications (user_id, read, created_at DESC);

CREATE OR REPLACE FUNCTION update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notifications_updated_at ON public.notifications;
CREATE TRIGGER trg_notifications_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION update_notifications_updated_at();

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON public.notifications;
CREATE POLICY "Service role full access" ON public.notifications
  TO service_role FOR ALL USING (true) WITH CHECK (true);
REVOKE ALL ON public.notifications FROM anon, authenticated;
GRANT ALL ON public.notifications TO service_role;
```

- [ ] **Step 3: Apply migrations via Supabase SQL editor or CLI**

```bash
# Option A: CLI
npx supabase db push

# Option B: paste into Supabase dashboard SQL editor and run each migration file
```

- [ ] **Step 4: Commit migrations**

```bash
git add database/migrations/20260401_create_webhook_events.sql \
        database/migrations/20260401_ensure_notifications_schema.sql
git commit -m "feat: add webhook_events and notifications schema migrations"
```

---

## Task 2: TypeScript Types

**Files:**
- Create: `lib/types/notifications.ts`

- [ ] **Step 1: Write types**

```typescript
// lib/types/notifications.ts

export interface WebhookEvent {
  id: string;
  source: string;
  event_type: string;
  awb: string | null;
  payload: Record<string, unknown>;
  status: 'pending' | 'processing' | 'processed' | 'failed';
  attempt_count: number;
  next_retry_at: string | null;
  last_error: string | null;
  received_at: string;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'shipping_scan' | 'order_status' | 'payment_status';
  read: boolean;
  meta: NotificationMeta | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationMeta {
  order_id?: string;
  order_number?: string;
  awb?: string;
  scan_status?: string;
  scan_location?: string;
  scan_time?: string;
}

// Delhivery webhook payload shape (v1 contract — token header auth)
export interface DelhiveryWebhookScan {
  AWB: string;
  Status: string;            // e.g. "Manifested", "In Transit", "Delivered"
  StatusType?: string;       // e.g. "UD", "IT", "DL"
  StatusDateTime: string;    // ISO or Delhivery datetime string
  StatusLocation?: string;
  Instructions?: string;
  PickUpDate?: string;
  ReferenceNo?: string;
}

export interface DelhiveryWebhookPayload {
  // Delhivery may POST an array of scans or a single object
  // We normalise to always work with an array
  scans?: DelhiveryWebhookScan[];
  // Single-scan flat format (alternative shape)
  AWB?: string;
  Status?: string;
  StatusType?: string;
  StatusDateTime?: string;
  StatusLocation?: string;
  Instructions?: string;
}

export interface WebhookMetrics {
  pending_count: number;
  processing_count: number;
  failed_count: number;
  oldest_pending_age_seconds: number | null;
  last_processed_at: string | null;
  recent_failures: Array<{
    id: string;
    attempt_count: number;
    last_error: string | null;
    updated_at: string;
  }>;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/types/notifications.ts
git commit -m "feat: add notification and webhook event TypeScript types"
```

---

## Task 3: Delhivery Webhook Payload Parser

**Files:**
- Create: `lib/services/delhivery-webhook.ts`
- Test: (inline vitest or verify via integration)

- [ ] **Step 1: Write the parser service**

```typescript
// lib/services/delhivery-webhook.ts
import type { DelhiveryWebhookPayload, DelhiveryWebhookScan } from "@/lib/types/notifications";

export interface ParsedWebhookScan {
  awb: string;
  status: string;
  status_type: string | null;
  status_datetime: string;
  status_location: string | null;
  instructions: string | null;
}

export interface ParsedWebhookResult {
  scans: ParsedWebhookScan[];
  raw_awb: string | null;
}

/**
 * Normalise a raw Delhivery webhook payload into a predictable array of scans.
 * Handles both array format ({ scans: [...] }) and flat single-scan format.
 * Never throws — returns { scans: [], raw_awb: null } on unrecognised shape.
 */
export function parseDelhiveryWebhookPayload(
  body: unknown
): ParsedWebhookResult {
  if (!body || typeof body !== "object") {
    return { scans: [], raw_awb: null };
  }

  const payload = body as DelhiveryWebhookPayload;

  // Array format: { scans: [{ AWB, Status, StatusDateTime, ... }] }
  if (Array.isArray(payload.scans) && payload.scans.length > 0) {
    const scans = payload.scans
      .filter(isScanValid)
      .map(normaliseScan);
    const raw_awb = scans[0]?.awb ?? null;
    return { scans, raw_awb };
  }

  // Flat single-scan format: { AWB, Status, StatusDateTime, ... }
  if (payload.AWB && payload.Status && payload.StatusDateTime) {
    const scan = normaliseScan(payload as DelhiveryWebhookScan);
    return { scans: [scan], raw_awb: scan.awb };
  }

  return { scans: [], raw_awb: null };
}

function isScanValid(scan: DelhiveryWebhookScan): boolean {
  return !!(scan?.AWB?.trim() && scan?.Status?.trim() && scan?.StatusDateTime?.trim());
}

function normaliseScan(scan: DelhiveryWebhookScan): ParsedWebhookScan {
  return {
    awb:              scan.AWB?.trim() ?? "",
    status:           scan.Status?.trim() ?? "",
    status_type:      scan.StatusType?.trim() || null,
    status_datetime:  scan.StatusDateTime?.trim() ?? new Date().toISOString(),
    status_location:  scan.StatusLocation?.trim() || null,
    instructions:     scan.Instructions?.trim() || null,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/services/delhivery-webhook.ts
git commit -m "feat: add Delhivery webhook payload parser service"
```

---

## Task 4: Notification Service (Fan-out + Retry Logic)

**Files:**
- Create: `lib/services/notification-service.ts`

- [ ] **Step 1: Write the notification service**

```typescript
// lib/services/notification-service.ts
import { createAdminSupabaseClient } from "@/lib/supabase-server";
import type { ParsedWebhookScan } from "@/lib/services/delhivery-webhook";
import type { NotificationMeta } from "@/lib/types/notifications";

const MAX_ATTEMPTS = 10;
// Exponential backoff caps in minutes: 1, 5, 15, 60, 60, ...
const BACKOFF_MINUTES = [1, 5, 15, 60, 60, 60, 60, 60, 60, 60];

/**
 * Calculate next retry time based on attempt count (1-indexed).
 */
export function nextRetryAt(attemptCount: number): Date {
  const minutesIndex = Math.min(attemptCount - 1, BACKOFF_MINUTES.length - 1);
  const minutes = BACKOFF_MINUTES[minutesIndex];
  return new Date(Date.now() + minutes * 60 * 1000);
}

/**
 * Fetch all active admin user IDs from admin_users table.
 */
export async function getActiveAdminIds(): Promise<string[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("admin_users")
    .select("id")
    .eq("is_active", true);

  if (error) {
    throw new Error(`Failed to fetch admin users: ${error.message}`);
  }

  return (data ?? []).map((row: { id: string }) => row.id);
}

/**
 * Resolve order by AWB tracking number.
 * Returns { id, order_number } or null if not found.
 */
export async function resolveOrderByAwb(
  awb: string
): Promise<{ id: string; order_number: string } | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number")
    .eq("tracking_number", awb)
    .maybeSingle();

  if (error) {
    console.warn(`resolveOrderByAwb: DB error for AWB ${awb}: ${error.message}`);
    return null;
  }
  return data ?? null;
}

/**
 * Create one notification row per admin user for a given scan.
 * Wrapped in a transaction — all inserts must succeed or none are written.
 * Throws on failure so caller can retry.
 */
export async function createNotificationsForScan(
  scan: ParsedWebhookScan,
  adminIds: string[],
  order: { id: string; order_number: string } | null
): Promise<void> {
  if (adminIds.length === 0) {
    throw new Error("no_admin_recipients");
  }

  const location = scan.status_location ? ` at ${scan.status_location}` : "";
  const orderLabel = order ? ` — Order ${order.order_number}` : ` — AWB ${scan.awb}`;
  const title = `Shipment scan: ${scan.status}`;
  const message = `AWB ${scan.awb}${orderLabel}${location}, ${formatScanDateTime(scan.status_datetime)}`;

  const meta: NotificationMeta = {
    awb: scan.awb,
    scan_status: scan.status,
    scan_location: scan.status_location ?? undefined,
    scan_time: scan.status_datetime,
    ...(order ? { order_id: order.id, order_number: order.order_number } : {}),
  };

  const rows = adminIds.map((user_id) => ({
    user_id,
    title,
    message,
    type: "shipping_scan" as const,
    read: false,
    meta,
  }));

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("notifications").insert(rows);

  if (error) {
    throw new Error(`Notification insert failed: ${error.message}`);
  }
}

/**
 * Format a datetime string for human display in notifications.
 */
function formatScanDateTime(raw: string): string {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: false });
}

export { MAX_ATTEMPTS };
```

- [ ] **Step 2: Commit**

```bash
git add lib/services/notification-service.ts
git commit -m "feat: add notification fan-out service with admin lookup and retry helpers"
```

---

## Task 5: Core Webhook Processor

**Files:**
- Create: `lib/services/webhook-processor.ts`

- [ ] **Step 1: Write the processor**

```typescript
// lib/services/webhook-processor.ts
import { createAdminSupabaseClient } from "@/lib/supabase-server";
import { parseDelhiveryWebhookPayload } from "@/lib/services/delhivery-webhook";
import {
  getActiveAdminIds,
  resolveOrderByAwb,
  createNotificationsForScan,
  nextRetryAt,
  MAX_ATTEMPTS,
} from "@/lib/services/notification-service";

const BATCH_SIZE = 50;
// Lease timeout: events stuck in 'processing' longer than this become reclaimable
const LEASE_TIMEOUT_MINUTES = 10;

export interface ProcessorResult {
  claimed: number;
  processed: number;
  failed: number;
  skipped: number;
}

/**
 * Process a batch of pending/retry-eligible webhook events.
 * Safe to run concurrently — uses SKIP LOCKED.
 */
export async function processWebhookEventBatch(): Promise<ProcessorResult> {
  const supabase = createAdminSupabaseClient();
  const result: ProcessorResult = { claimed: 0, processed: 0, failed: 0, skipped: 0 };

  const leaseThreshold = new Date(
    Date.now() - LEASE_TIMEOUT_MINUTES * 60 * 1000
  ).toISOString();
  const now = new Date().toISOString();

  // Claim processable events atomically via rpc to leverage FOR UPDATE SKIP LOCKED
  const { data: events, error: claimError } = await supabase.rpc(
    "claim_webhook_events",
    {
      p_batch_size: BATCH_SIZE,
      p_lease_threshold: leaseThreshold,
      p_now: now,
    }
  );

  if (claimError) {
    console.error("webhook-processor: claim failed", claimError.message);
    return result;
  }

  if (!events || events.length === 0) return result;
  result.claimed = events.length;

  // Fetch admin IDs once for this batch
  let adminIds: string[];
  try {
    adminIds = await getActiveAdminIds();
  } catch (err) {
    console.error("webhook-processor: could not load admin IDs", err);
    // Mark all claimed events as retryable
    for (const event of events) {
      await markFailed(supabase, event.id, event.attempt_count, "getActiveAdminIds failed");
      result.failed++;
    }
    return result;
  }

  for (const event of events) {
    try {
      const warningNote = await processEvent(event, adminIds);
      await markProcessed(supabase, event.id, warningNote ?? null);
      result.processed++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`webhook-processor: event ${event.id} failed:`, errorMsg);
      // Use attempt_count + 1 so first failure → attempt 1, second → attempt 2, etc.
      await markFailed(supabase, event.id, event.attempt_count + 1, errorMsg);
      result.failed++;
    }
  }

  return result;
}

/**
 * Returns a warning string if any scans had unmatched AWBs (stored on last_error),
 * or null if all scans resolved cleanly.
 * Never throws for unmatched AWBs — unmatched is a warning, not a failure.
 */
async function processEvent(
  event: { id: string; payload: Record<string, unknown>; awb: string | null },
  adminIds: string[]
): Promise<string | null> {
  const { scans } = parseDelhiveryWebhookPayload(event.payload);
  const warnings: string[] = [];

  if (scans.length === 0) {
    console.warn(`webhook-processor: no valid scans in event ${event.id}`);
    return null; // Treat as processed — unreadable payloads should not retry forever
  }

  for (const scan of scans) {
    const order = await resolveOrderByAwb(scan.awb);
    if (!order) {
      const warn = `WARN_UNMATCHED_AWB:${scan.awb}`;
      console.warn(`webhook-processor: ${warn} in event ${event.id}`);
      warnings.push(warn);
    }
    // Still fan-out even for unmatched — admins see the scan without order context
    await createNotificationsForScan(scan, adminIds, order);
  }

  return warnings.length > 0 ? warnings.join("; ") : null;
}

async function markProcessed(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  eventId: string,
  warningNote: string | null
): Promise<void> {
  const { error } = await supabase
    .from("webhook_events")
    .update({
      status: "processed",
      processed_at: new Date().toISOString(),
      // Store warning note (e.g. WARN_UNMATCHED_AWB) for observability; not a failure
      ...(warningNote ? { last_error: warningNote } : {}),
    })
    .eq("id", eventId);
  if (error) console.error(`markProcessed failed for ${eventId}:`, error.message);
}

async function markFailed(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  eventId: string,
  attemptCount: number,
  errorMsg: string
): Promise<void> {
  const isFinal = attemptCount >= MAX_ATTEMPTS;
  const update = isFinal
    ? { status: "failed" as const, attempt_count: attemptCount, last_error: errorMsg }
    : {
        status: "pending" as const,
        attempt_count: attemptCount,
        last_error: errorMsg,
        next_retry_at: nextRetryAt(attemptCount).toISOString(),
      };

  const { error } = await supabase
    .from("webhook_events")
    .update(update)
    .eq("id", eventId);
  if (error) console.error(`markFailed update failed for ${eventId}:`, error.message);
}
```

- [ ] **Step 2: Add the `claim_webhook_events` Supabase RPC function**

Create a new SQL migration for this function (needed for `FOR UPDATE SKIP LOCKED`):

```sql
-- database/migrations/20260401_claim_webhook_events_rpc.sql

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
      -- New events with no scheduled backoff
      (status = 'pending' AND (next_retry_at IS NULL OR next_retry_at <= p_now))
      -- Retry-eligible failures past their backoff window
      OR (status = 'failed' AND next_retry_at IS NOT NULL AND next_retry_at <= p_now)
      -- Stale processing rows whose lease has expired
      OR (status = 'processing' AND updated_at <= p_lease_threshold)
    )
    ORDER BY created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;

GRANT EXECUTE ON FUNCTION public.claim_webhook_events TO service_role;
```

> **Important:** `markFailed` in `webhook-processor.ts` sets retried events back to `status = 'pending'` with a future `next_retry_at`. The claim function above only picks up `pending` rows where `next_retry_at IS NULL OR next_retry_at <= NOW()`, so backoff is honoured correctly.

Apply this migration before deploying the processor.

- [ ] **Step 3: Commit**

```bash
git add lib/services/webhook-processor.ts \
        database/migrations/20260401_claim_webhook_events_rpc.sql
git commit -m "feat: add webhook processor service with claim/process/retry logic"
```

---

## Task 6: Webhook Ingest Route

**Files:**
- Create: `app/api/webhooks/delhivery/route.ts`

- [ ] **Step 1: Write the webhook ingest route**

```typescript
// app/api/webhooks/delhivery/route.ts
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createAdminSupabaseClient } from "@/lib/supabase-server";

const MAX_BODY_BYTES = 1_048_576; // 1 MB

function constantTimeEqual(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      // Still do a comparison to avoid timing leak on length
      timingSafeEqual(bufA, Buffer.alloc(bufA.length));
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Validate webhook token
  const expectedToken = process.env.DELHIVERY_WEBHOOK_TOKEN?.trim();
  if (!expectedToken) {
    console.error("DELHIVERY_WEBHOOK_TOKEN not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const incomingToken = request.headers.get("x-delhivery-token")?.trim() ?? "";
  if (!constantTimeEqual(incomingToken, expectedToken)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Read body with size guard
  const contentLength = parseInt(request.headers.get("content-length") ?? "0", 10);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid payload shape" }, { status: 400 });
  }

  // 3. Extract AWB for indexing (best-effort)
  const awb = extractAwb(body);

  // 4. Persist durable event — must succeed before returning 202
  const supabase = createAdminSupabaseClient();
  const { error: insertError } = await supabase.from("webhook_events").insert({
    source: "delhivery",
    event_type: "shipment_scan",
    awb,
    payload: body,
    status: "pending",
    received_at: new Date().toISOString(),
  });

  if (insertError) {
    console.error("webhook_events insert failed:", insertError.message);
    // Return 500 so Delhivery retries
    return NextResponse.json({ error: "Failed to persist event" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 202 });
}

function extractAwb(body: Record<string, unknown>): string | null {
  // Handle both { AWB } flat format and { scans: [{ AWB }] } array format
  if (typeof body.AWB === "string" && body.AWB.trim()) return body.AWB.trim();
  const scans = body.scans;
  if (Array.isArray(scans) && scans.length > 0) {
    const first = scans[0];
    if (first && typeof first === "object" && "AWB" in first && typeof first.AWB === "string") {
      return first.AWB.trim() || null;
    }
  }
  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/webhooks/delhivery/route.ts
git commit -m "feat: add Delhivery webhook ingest route with constant-time auth and durable insert"
```

---

## Task 7: Internal Worker Route

**Files:**
- Create: `app/api/internal/webhooks/delhivery/process/route.ts`

- [ ] **Step 1: Write the worker route**

```typescript
// app/api/internal/webhooks/delhivery/process/route.ts
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { processWebhookEventBatch } from "@/lib/services/webhook-processor";

const JOB_TIMEOUT_MS = 20_000; // 20 seconds
const MAX_JOB_AGE_MS  = 5 * 60 * 1000; // 5-minute replay window

function constantTimeEqual(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      timingSafeEqual(bufA, Buffer.alloc(bufA.length));
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Allow Vercel cron invocations (header set by Vercel infra only — not forgeable externally)
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";

  if (!isVercelCron) {
    // Validate internal job token for non-cron callers
    const expectedToken = process.env.INTERNAL_JOB_TOKEN?.trim();
    if (!expectedToken) {
      console.error("INTERNAL_JOB_TOKEN not configured");
      return NextResponse.json({ error: "Not configured" }, { status: 500 });
    }

    const incoming = request.headers.get("x-internal-job-token")?.trim() ?? "";
    if (!constantTimeEqual(incoming, expectedToken)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Replay protection: x-job-ts must be present and within 5 minutes
    const jobTs = request.headers.get("x-job-ts");
    if (!jobTs) {
      return NextResponse.json({ error: "Missing x-job-ts header" }, { status: 400 });
    }
    const jobTsMs = parseInt(jobTs, 10);
    if (isNaN(jobTsMs) || Math.abs(Date.now() - jobTsMs) > MAX_JOB_AGE_MS) {
      return NextResponse.json({ error: "Request expired" }, { status: 401 });
    }
  }

  // Run processor with timeout guard
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("processor_timeout")), JOB_TIMEOUT_MS)
  );

  try {
    const result = await Promise.race([processWebhookEventBatch(), timeoutPromise]);
    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("webhook-processor route error:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/internal/webhooks/delhivery/process/route.ts
git commit -m "feat: add internal webhook processor route with job token auth"
```

---

## Task 8: Ops Metrics Route

**Files:**
- Create: `app/api/admin/ops/webhook-events/metrics/route.ts`

- [ ] **Step 1: Write the ops metrics route**

```typescript
// app/api/admin/ops/webhook-events/metrics/route.ts
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwt-auth";
import { createAdminSupabaseClient } from "@/lib/supabase-server";
import type { WebhookMetrics } from "@/lib/types/notifications";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await authenticateRequest(request);
  if (!auth.isAuthenticated || !auth.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const supabase = createAdminSupabaseClient();

  const [pendingRes, processingRes, failedRes, oldestRes, lastProcessedRes, recentFailedRes] =
    await Promise.all([
      supabase.from("webhook_events").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("webhook_events").select("id", { count: "exact", head: true }).eq("status", "processing"),
      supabase.from("webhook_events").select("id", { count: "exact", head: true }).eq("status", "failed"),
      supabase.from("webhook_events")
        .select("received_at")
        .eq("status", "pending")
        .order("received_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase.from("webhook_events")
        .select("processed_at")
        .eq("status", "processed")
        .order("processed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("webhook_events")
        .select("id, attempt_count, last_error, updated_at")
        .eq("status", "failed")
        .order("updated_at", { ascending: false })
        .limit(20),
    ]);

  const oldestPendingAge = oldestRes.data?.received_at
    ? Math.floor((Date.now() - new Date(oldestRes.data.received_at).getTime()) / 1000)
    : null;

  const metrics: WebhookMetrics = {
    pending_count:              pendingRes.count ?? 0,
    processing_count:           processingRes.count ?? 0,
    failed_count:               failedRes.count ?? 0,
    oldest_pending_age_seconds: oldestPendingAge,
    last_processed_at:          lastProcessedRes.data?.processed_at ?? null,
    recent_failures:            recentFailedRes.data ?? [],
  };

  return NextResponse.json({ metrics });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/ops/webhook-events/metrics/route.ts
git commit -m "feat: add admin ops metrics endpoint for webhook event queue health"
```

---

## Task 9: Wire Notifications API to DB

**Files:**
- Modify: `app/api/notifications/route.ts`

- [ ] **Step 1: Replace stub with DB-backed implementation**

Replace the entire file content:

```typescript
// app/api/notifications/route.ts
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwt-auth";
import { createAdminSupabaseClient } from "@/lib/supabase-server";

const PAGE_SIZE = 50;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await authenticateRequest(request);
  if (!auth.isAuthenticated) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  const { searchParams } = request.nextUrl;
  const cursor = searchParams.get("cursor"); // ISO datetime for cursor pagination

  const supabase = createAdminSupabaseClient();
  let query = supabase
    .from("notifications")
    .select("id, title, message, type, read, meta, created_at")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;

  if (error) {
    console.error("notifications fetch error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Map DB `read` -> `is_read` for NotificationCenter backward compat until component migrates
  const notifications = (data ?? []).map((n) => ({
    ...n,
    is_read: n.read,
  }));

  const nextCursor =
    notifications.length === PAGE_SIZE
      ? notifications[notifications.length - 1].created_at
      : null;

  return NextResponse.json({ notifications, next_cursor: nextCursor });
}
```

- [ ] **Step 2: Verify existing GET /api/notifications E2E test still passes**

```bash
npx playwright test tests/api.spec.ts --grep "notifications"
```

Expected: test passes (accepts 200, 401, or 403).

- [ ] **Step 3: Commit**

```bash
git add app/api/notifications/route.ts
git commit -m "feat: implement notifications API with DB-backed pagination"
```

---

## Task 10: Vercel Cron Configuration

**Files:**
- Create/modify: `vercel.json`

- [ ] **Step 1: Add cron job**

Check if `vercel.json` already exists:

```bash
ls vercel.json 2>/dev/null && echo "exists" || echo "not found"
```

If it doesn't exist, create it. If it does, merge the `crons` array in:

```json
{
  "crons": [
    {
      "path": "/api/internal/webhooks/delhivery/process",
      "schedule": "* * * * *"
    }
  ]
}
```

Note: The worker route written in Task 7 already handles Vercel cron via `x-vercel-cron: 1` header (set by Vercel infra; not forgeable externally). No additional changes needed here — Task 7 is the canonical implementation.

- [ ] **Step 2: Commit**

```bash
git add vercel.json app/api/internal/webhooks/delhivery/process/route.ts
git commit -m "feat: add Vercel cron config for 1-minute webhook processor schedule"
```

---

## Task 11: Environment Variables

**Files:**
- Modify: `env.template`
- Modify: `.env.test.example` (if present, else skip)

- [ ] **Step 1: Add new env vars to template**

Append to `env.template`:

```bash
# Delhivery Webhook Integration
# Token from Delhivery onboarding — set in header x-delhivery-token
DELHIVERY_WEBHOOK_TOKEN=your-delhivery-webhook-secret-token

# Internal Job Token — used to authenticate cron/internal worker calls
INTERNAL_JOB_TOKEN=your-internal-job-secret-token-min-32-chars
```

- [ ] **Step 2: Commit**

```bash
git add env.template
git commit -m "chore: add DELHIVERY_WEBHOOK_TOKEN and INTERNAL_JOB_TOKEN to env template"
```

---

## Task 11b: Fix PATCH /api/notifications/[id] Auth

**Files:**
- Modify: `app/api/notifications/[id]/route.ts`

The existing PATCH route uses `createServerSupabaseClient()` + `supabase.auth.getUser()`, which targets Supabase Auth. Admin users are stored in `admin_users` table and authenticated via a custom JWT (`authenticateRequest`). This mismatch means mark-as-read fails for admin-created notifications. Fix it to use the same auth and DB access pattern as the rest of the admin API.

- [ ] **Step 1: Rewrite PATCH to use admin JWT auth + service-role client**

Replace the entire file:

```typescript
// app/api/notifications/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwt-auth";
import { createAdminSupabaseClient } from "@/lib/supabase-server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = await authenticateRequest(request);
  if (!auth.isAuthenticated) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Notification ID is required" }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();

  // Only mark as read if the notification belongs to the authenticated admin
  const { data, error } = await supabase
    .from("notifications")
    .update({ read: true, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", auth.userId)
    .select()
    .maybeSingle();

  if (error) {
    console.error("notifications PATCH error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      { error: "Notification not found or unauthorized" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/notifications/[id]/route.ts
git commit -m "fix: rewrite notification mark-as-read to use admin JWT auth and service-role client"
```

---

## Task 12: API Tests

**Files:**
- Modify: `tests/api.spec.ts`

- [ ] **Step 1: Add tests for new routes**

Append to `tests/api.spec.ts` inside the `test.describe('API Routes', ...)` block:

```typescript
  // ── Delhivery Webhook ──────────────────────────────────────────────

  test('POST /api/webhooks/delhivery without token should return 401', async ({ request }) => {
    const response = await request.post('/api/webhooks/delhivery', {
      data: { AWB: '1234567890', Status: 'In Transit', StatusDateTime: '2026-04-01T10:00:00' },
    });
    expect(response.status()).toBe(401);
  });

  test('POST /api/webhooks/delhivery with wrong token should return 401', async ({ request }) => {
    const response = await request.post('/api/webhooks/delhivery', {
      headers: { 'x-delhivery-token': 'wrong-token' },
      data: { AWB: '1234567890', Status: 'In Transit', StatusDateTime: '2026-04-01T10:00:00' },
    });
    expect(response.status()).toBe(401);
  });

  test('POST /api/webhooks/delhivery with invalid JSON should return 400 or 401', async ({ request }) => {
    const response = await request.post('/api/webhooks/delhivery', {
      headers: { 'content-type': 'application/json' },
      data: 'not valid json',
    });
    expect([400, 401]).toContain(response.status());
  });

  // ── Internal Webhook Processor ──────────────────────────────────────

  test('POST /api/internal/webhooks/delhivery/process without token should return 401', async ({ request }) => {
    const response = await request.post('/api/internal/webhooks/delhivery/process');
    expect(response.status()).toBe(401);
  });

  // ── Ops Metrics ─────────────────────────────────────────────────────

  test('GET /api/admin/ops/webhook-events/metrics without auth should return 403', async ({ request }) => {
    const response = await request.get('/api/admin/ops/webhook-events/metrics');
    expect([401, 403]).toContain(response.status());
  });
```

- [ ] **Step 2: Run tests**

```bash
npx playwright test tests/api.spec.ts
```

Expected: all tests pass (new tests verify auth rejection; no actual valid tokens in test env).

- [ ] **Step 3: Commit**

```bash
git add tests/api.spec.ts
git commit -m "test: add webhook ingest, processor, and ops metrics endpoint auth tests"
```

---

## Task 13: Final Smoke Test + PR Prep

- [ ] **Step 1: Run full test suite**

```bash
npx playwright test
```

Verify no regressions.

- [ ] **Step 2: Confirm all env vars are documented**

```bash
grep -E "DELHIVERY_WEBHOOK_TOKEN|INTERNAL_JOB_TOKEN" env.template
```

Expected: both entries visible.

- [ ] **Step 3: Verify Next.js build passes**

```bash
npx next build
```

Expected: no TypeScript or build errors.

- [ ] **Step 4: Final commit if any loose changes**

```bash
git status
git add -A
git commit -m "chore: final cleanup after notification system implementation"
```

---

## Deployment Notes

1. Set `DELHIVERY_WEBHOOK_TOKEN` and `INTERNAL_JOB_TOKEN` in Vercel environment variables before deploying.
2. Apply all SQL migrations in Supabase SQL editor in order:
   - `20260401_create_webhook_events.sql`
   - `20260401_ensure_notifications_schema.sql`
   - `20260401_claim_webhook_events_rpc.sql`
3. Share `POST /api/webhooks/delhivery` URL with Delhivery onboarding team along with the `x-delhivery-token` header value.
4. Cron kicks in automatically once `vercel.json` is deployed and Vercel cron is enabled for the project.
5. Monitor queue health at `GET /api/admin/ops/webhook-events/metrics` after first webhook hits.

---

## Spec Reference

`docs/superpowers/specs/2026-04-01-delhivery-admin-notification-system-design.md`
