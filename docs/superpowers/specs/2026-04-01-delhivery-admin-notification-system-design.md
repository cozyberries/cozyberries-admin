# Delhivery Admin Notification System — Design Spec

**Date:** 2026-04-01
**Status:** Draft (Approved in chat, in spec review loop)
**Project:** cozyberries-admin

---

## 1. Context

The admin portal already has:
- Delhivery pull-based tracking integration in `app/api/admin/shipping/delhivery/tracking/route.ts`.
- A `NotificationCenter` UI in `components/NotificationCenter.tsx`.
- Notification API stubs in `app/api/notifications/route.ts` and `app/api/notifications/[id]/route.ts`.

Current gaps:
- No webhook ingestion path for Delhivery push scans.
- No durable event pipeline to guarantee scan events are not lost.
- `GET /api/notifications` currently returns a stubbed empty list.

This feature adds a reliable, auditable notification pipeline so admins are informed whenever order/payment/shipping milestones and Delhivery scan updates happen, with explicit "no silent loss" guarantees.

---

## 2. Goals

- Build admin in-app notifications for order lifecycle and shipping scan updates.
- Ingest and process **all Delhivery scans** from webhooks.
- Notify **all admins** for each scan event.
- Allow duplicate notifications if Delhivery sends duplicate scans.
- Ensure no silent data loss through durable event storage + retries.
- Provide observability for pending/failed webhook processing.

## 3. Non-Goals

- Customer-facing notifications (email, SMS, WhatsApp, push).
- Deduplication of duplicate upstream scans.
- Replacing existing Delhivery pull tracking panel.
- Multi-carrier normalization beyond Delhivery in v1.

---

## 4. Decisions Captured From Brainstorming

- Audience: `admin_only_in_app`
- Scan policy: `all_scans`
- Recipient scope: `all_admins`
- Duplicate policy: `allow_duplicates`
- Reliability mode: `accept_and_queue` (durable ingest + async processing)

---

## 5. Architecture

### 5.1 High-level flow

1. Delhivery POSTs webhook payload to `POST /api/webhooks/delhivery`.
2. Route validates request and persists full payload into `webhook_events` as `pending`.
3. Route returns `202` quickly after durable write.
4. Background processor claims events in batches and creates notifications for all admins.
5. Processor updates event status (`processed` or `failed`) with retry metadata.
6. `NotificationCenter` fetches real data from `GET /api/notifications`.

Queue recovery rule:
- Events stuck in `processing` beyond a lease timeout (e.g. 10 minutes) are automatically reclaimable by a future worker run and treated as retryable.

### 5.2 Component boundaries

```text
Delhivery webhook
  -> POST /api/webhooks/delhivery
      -> validate + persist webhook_events (jsonb payload)
          -> async processor (cron/worker)
              -> map scans -> notification records
              -> fan-out to all admins
              -> update webhook_events status/retry metadata
                  -> GET /api/notifications for NotificationCenter
```

### 5.3 Why this architecture

- Durable-first ingestion prevents silent drops.
- Async processing isolates webhook reliability from notification fan-out latency.
- Replay from `webhook_events` supports incident recovery and auditing.

---

## 6. Data Model

### 6.1 `webhook_events` (new table)

- `id uuid primary key default gen_random_uuid()`
- `source text not null` (`delhivery`)
- `event_type text not null` (e.g. `shipment_scan`)
- `awb text null`
- `payload jsonb not null`
- `status text not null check (status in ('pending','processing','processed','failed'))`
- `attempt_count int not null default 0`
- `next_retry_at timestamptz null`
- `last_error text null`
- `received_at timestamptz not null default now()`
- `processed_at timestamptz null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes:
- `(status, next_retry_at, created_at)`
- `(awb, created_at desc)`

Retention:
- Keep for 90 days by default (`WEBHOOK_EVENTS_RETENTION_DAYS`, optional override).

### 6.2 `notifications` (ensure/extend)

Canonical columns (v1 canonical field is `read`, not `is_read`):
- `id uuid pk`
- `user_id uuid not null`
- `title text not null`
- `message text not null`
- `type text not null` (use `shipping_scan`, `order_status`, `payment_status`)
- `read boolean not null default false`
- `meta jsonb null`:
  - `order_id`
  - `order_number`
  - `awb`
  - `scan_status`
  - `scan_location`
  - `scan_time`
- `created_at`, `updated_at`

Indexes:
- `(user_id, read, created_at desc)`

Compatibility note:
- Existing UI currently reads `is_read`. During implementation, API response will map DB `read` to `is_read` for backward compatibility in the component, then UI will migrate to a single canonical `read` field.

---

## 7. API Design

### 7.1 `POST /api/webhooks/delhivery` (new)

Responsibilities:
- Validate webhook authenticity using a shared secret token header from Delhivery onboarding (v1 contract):
  - required header: `x-delhivery-token`
  - expected value: `DELHIVERY_WEBHOOK_TOKEN` (server env)
  - compare using constant-time check
  - reject missing/invalid token with `401`
- Parse and validate payload shape.
- Persist event row with raw payload.
- Return `202` when persisted.

Responses:
- `202` `{ ok: true }` after durable write.
- `400` for invalid payload.
- `401` for failed auth validation.
- `500` when durable write fails (allows upstream retry behavior).

### 7.2 `POST /api/internal/webhooks/delhivery/process` (new internal worker trigger)

Responsibilities:
- Claim processable events:
  - `pending`
  - retry-eligible `failed` where `next_retry_at <= now()`
  - stale `processing` where `updated_at <= now() - interval '10 minutes'`
- Process in bounded batches.
- Fan-out notifications to all admin users.
- Update event status and retry metadata.
- Be idempotent under concurrent scheduler invocations: if another worker has already claimed rows, this run exits successfully with zero processed.

Security:
- Internal auth token required (`x-internal-job-token` = `INTERNAL_JOB_TOKEN`, constant-time compare).
- Method restricted to POST.
- Reject requests older than 5 minutes using signed timestamp header (`x-job-ts`) to reduce replay risk.
- Not publicly callable by browsers.

### 7.3 `GET /api/notifications` (existing, complete implementation)

Responsibilities:
- Authenticated user only.
- Return notifications from DB ordered by newest first.
- Support pagination for scalability.

### 7.4 `PATCH /api/notifications/:id` (existing, align fields)

Responsibilities:
- Mark a user-owned notification as read.
- Keep current ownership checks.

---

## 8. Processing Rules

### 8.1 Event handling

- Ingest all scans from Delhivery payload.
- For each scan:
  - Resolve order by AWB (`orders.tracking_number`).
  - Build notification content with status/location/time.
  - Insert one notification per admin user.

Admin recipient source (authoritative):
- Use `admin_users` table as source of truth for active admins.
- If no active admins found, treat event as retryable failure (`last_error = 'no_admin_recipients'`) rather than silently marking success.

### 8.2 Duplicate policy

- No dedupe in v1 (intentional).
- Repeated webhook scans create additional notifications.

### 8.3 Unknown mapping policy

- If AWB does not map to an order, mark event as processed with warning metadata/log.
- Do not block processing pipeline for other events.
- Store warning details in `webhook_events.last_error` with a prefixed code (e.g. `WARN_UNMATCHED_AWB:<awb>`), and also structured server log entry.

### 8.4 Fan-out completion semantics

- Event is marked `processed` only after all notification rows for all active admins are inserted successfully.
- If insertion fails mid-fan-out, transaction is rolled back for that scan batch and event remains retryable.
- This avoids partial delivery being marked as success.

---

## 9. Retry and Reliability

### 9.1 Retry strategy

- On transient failure:
  - increment `attempt_count`
  - set `next_retry_at` with exponential backoff (1m, 5m, 15m, 60m, then capped)
  - persist `last_error`
- Max attempts: 10
- After max attempts: status = `failed` for manual replay.
- `processing` lease timeout: 10 minutes; stale rows become claimable again.

### 9.2 Concurrency safety

- Claim rows with transaction + `FOR UPDATE SKIP LOCKED` to avoid double processing by parallel workers.
- Status transitions:
  - `pending -> processing -> processed`
  - `pending/processing -> failed` on repeated errors

### 9.3 No-loss evidence

- Every inbound payload is durably stored before async fan-out.
- Failed items remain queryable and replayable.
- Operational metrics expose queue health and failures.

### 9.4 Processing SLO and safeguards

- Scheduler cadence: every 1 minute.
- Batch size: 50 events max per run.
- Per-run execution cap: 20 seconds, then exit gracefully.
- Queue lag SLO: `oldest_pending_age < 5 minutes` under normal load.

### 9.5 Diagnostics contract

Add internal/admin diagnostics endpoint:
- `GET /api/admin/ops/webhook-events/metrics`
- Response:
  - `pending_count`
  - `processing_count`
  - `failed_count`
  - `oldest_pending_age_seconds`
  - `last_processed_at`
  - `recent_failures` (top 20 with `id`, `attempt_count`, `last_error`, `updated_at`)

---

## 10. Admin UX Impact

### 10.1 Notification Center behavior

- Keep existing bell + panel.
- Replace stub API data with actual DB-backed notifications.
- Continue mark-as-read behavior.

### 10.2 Notification message examples

- `Shipment scan: Manifested` — `Order CB-1042 (AWB 1234567890) at Bhiwandi Hub, 2026-04-01 11:07`
- `Shipment scan: Out for Delivery` — `Order CB-1042 (AWB 1234567890) at Andheri, 2026-04-02 09:11`

---

## 11. Security and Compliance

- Webhook secret/header checks must happen server-side only.
- Use constant-time token comparisons for webhook and internal job auth checks.
- No Delhivery credentials in client code or `NEXT_PUBLIC_*` vars.
- Apply request size limits and strict JSON parsing.
- Sanitize logs to avoid leaking sensitive payload details.

---

## 12. Testing Strategy

- Unit:
  - payload parser/mapper
  - retry backoff calculator
  - notification message formatter
- Integration:
  - webhook ingest persists `webhook_events`
  - processor creates notifications for all admins
  - retry transitions and terminal failed state
  - stale `processing` rows are reclaimed after lease timeout
  - partial fan-out insertion failures rollback and retry cleanly
- E2E:
  - NotificationCenter shows new webhook-driven notifications
  - mark-as-read works
  - failed events visible in ops diagnostics endpoint/page

---

## 13. Implementation Scope (Expected Files)

Add:
- `app/api/webhooks/delhivery/route.ts`
- `app/api/internal/webhooks/delhivery/process/route.ts`
- `lib/services/delhivery-webhook.ts`
- `lib/services/notification-service.ts`
- `database/migrations/<timestamp>_create_webhook_events.sql`
- `database/migrations/<timestamp>_ensure_notifications_schema.sql` (if needed)

Modify:
- `app/api/notifications/route.ts` (replace stub)
- `components/NotificationCenter.tsx` (field alignment + pagination readiness)
- Possibly admin settings/ops page for queue health visibility

---

## 14. Open Integration Dependencies

- Delhivery may later provide stronger signing semantics; v1 assumes token header auth is available.
- If header contract differs, only webhook auth adapter in `POST /api/webhooks/delhivery` changes; queue/storage/processor contracts stay unchanged.

Worker scheduling decision for v1:
- Use Vercel cron calling internal process endpoint every minute.

Reference:
- [Delhivery webhook functionality](https://one.delhivery.com/developer-portal/document/b2c/detail/webhook_functionality)

