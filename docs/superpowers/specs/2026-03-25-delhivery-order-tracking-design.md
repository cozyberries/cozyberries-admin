# Delhivery Order Tracking — Design Spec

**Date:** 2026-03-25
**Status:** Approved
**Project:** cozyberries-admin

---

## 1. Context

The admin portal (`cozyberries-admin`) is a Next.js 16 App Router application using Supabase for data, Upstash Redis for caching, custom JWT auth (`lib/jwt-auth.ts`), and Tailwind + shadcn/ui components.

Orders already have `tracking_number` and `carrier_name` stored on the `orders` table. Admins manually set these when shipping an order. There is currently no live integration with Delhivery — admins can only see the static tracking number.

This feature adds a live Delhivery shipment scan timeline inside the admin Order Details modal, with a small persisted status summary for resilience.

---

## 2. Goals

- Show live Delhivery tracking scans to admins from inside the existing Order Detail modal.
- Support lookup by **waybill (AWB / `tracking_number`)** as the primary identifier. Admins can also search orders by internal order number (handled by existing search in the orders list UI — the detail modal is only opened for a specific order that already has a `tracking_number` on it, so no secondary resolution path is needed inside the tracking route).
- Auto-fetch on modal open and refresh periodically while the modal is open.
- Cache Delhivery API responses server-side (Upstash) to avoid rate limits (750 req / 5 min / IP).
- Persist a small summary (latest status, scan time, location) to the `orders` table for resilience.
- Never expose the Delhivery API token to the client.

## 3. Non-Goals

- Storing full scan history in the database.
- Delhivery Push API / webhook integration.
- Order creation or waybill generation via Delhivery API.
- Showing Delhivery tracking to end-customers (this is admin-only).
- Supporting carriers other than Delhivery.

---

## 4. Architecture

### 4.1 Component boundaries

```
Browser (admin client)
  └── OrderDetailModal (existing "use client" component)
        └── DelhiveryTrackingPanel (new "use client" sub-component)
              └── useDelhiveryTracking hook (TanStack Query)
                    └── GET /api/admin/shipping/delhivery/tracking
                          ├── authenticateRequest() — must be isAdmin
                          ├── UpstashService — get/set cache (60–120s TTL)
                          ├── fetch → https://track.delhivery.com/api/v1/packages/ (Pull API)
                          └── supabase.from("orders").update(summary) — if order_id provided
```

### 4.2 Carrier detection rule

The Delhivery panel is shown **only** when all three conditions are true:
1. `order.carrier_name` case-insensitively includes `"delhivery"`.
2. `order.tracking_number` is a non-empty string.
3. Order status is `"shipped"` or `"delivered"`.

Otherwise, only the existing manual tracking fields are shown.

---

## 5. Data Model

### 5.1 Migration — `database/migrations/add_delhivery_tracking_summary.sql`

```sql
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delhivery_latest_status    TEXT,
  ADD COLUMN IF NOT EXISTS delhivery_latest_scan_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delhivery_latest_location  TEXT;
```

### 5.2 TypeScript type update — `lib/types/order.ts`

Add to the `Order` interface:

```ts
delhivery_latest_status?:   string;
delhivery_latest_scan_at?:  string;
delhivery_latest_location?: string;
```

### 5.3 Delhivery scan shape (runtime, not persisted)

```ts
interface DelhiveryScan {
  time:      string;   // ISO datetime or Delhivery format
  status:    string;   // e.g. "In Transit", "Delivered", "Out for delivery"
  location?: string;
  activity?: string;
}

interface DelhiveryTrackingResult {
  waybill:           string;
  current_status:    string;
  current_location?: string;
  scans:             DelhiveryScan[];
  fetch_time:        string;  // ISO — when our server fetched this
}
```

---

## 6. Server Route

### `GET /api/admin/shipping/delhivery/tracking`

**File:** `app/api/admin/shipping/delhivery/tracking/route.ts`

#### Auth
- Uses `authenticateRequest(request)` from `lib/jwt-auth.ts`.
- Returns `403` if `!auth.isAuthenticated || !auth.isAdmin`.

#### Query parameters
| Param      | Required | Description |
|-----------|----------|-------------|
| `waybill`  | Yes      | Delhivery AWB (= `order.tracking_number`) |
| `order_id` | No       | Internal order UUID — if provided, the route validates it matches the waybill before persisting summary |

#### Cache key
`delhivery:track:<waybill>` — TTL 90s via `UpstashService.set` / `UpstashService.get` (stays well within the 750 req / 5 min limit). On Upstash failure, fall through to a live Delhivery call rather than returning an error — but do **not** retry the cache write so we avoid hammering Delhivery on a Redis outage.

#### Flow
1. Auth check — `authenticateRequest()`. Return **403** if `!isAdmin`.
2. Validate `waybill` is present and non-empty — return **400** if missing.
3. If `DELHIVERY_API_TOKEN` is not set — return **500** `{ error: "Delhivery integration not configured" }`.
4. Check `UpstashService.get("delhivery:track:<waybill>")` — if HIT, return `{ data: <cached>, cached: true }`.
5. Call Delhivery Pull API:
   - URL: `${DELHIVERY_API_BASE_URL}/api/v1/packages/?waybill=<waybill>`
   - Default base URL: `https://track.delhivery.com`
   - Header: `Authorization: Token ${DELHIVERY_API_TOKEN}`
   - Timeout: 10 000ms
6. Parse Delhivery JSON response (see "Delhivery Pull API — response shape" sub-section below). Map to `DelhiveryTrackingResult`.
7. Write result to Upstash with 90s TTL (`UpstashService.set`).
8. If `order_id` is provided:
   a. Fetch `orders` row using `createAdminSupabaseClient()` (service role, same as all other admin route handlers) to verify `tracking_number === waybill` AND `carrier_name` ilike `%delhivery%`. If mismatch, skip persistence (log a warning) — **do not fail the response**.
   b. If match and order status is `"shipped"` or `"delivered"`: call `supabase.from("orders").update({ delhivery_latest_status, delhivery_latest_scan_at, delhivery_latest_location })` — fire-and-forget; log on failure but do not propagate.
9. Return `{ data: DelhiveryTrackingResult, cached: false }`.

#### Delhivery Pull API — response shape

The Delhivery tracking API (`GET https://track.delhivery.com/api/v1/packages/?waybill=<AWB>`) returns:

```json
{
  "ShipmentData": [
    {
      "Shipment": {
        "AWB": "1234567890",
        "Status": {
          "Status": "In Transit",
          "StatusLocation": "Mumbai",
          "StatusDateTime": "2026-03-25T10:30:00",
          "Instructions": "Package received at facility",
          "StatusType": "IT"
        },
        "Scans": [
          {
            "ScanDetail": {
              "ScanDateTime": "2026-03-25T10:30:00",
              "Scan": "In Transit",
              "ScannedLocation": "Mumbai",
              "Instructions": "Package received at facility",
              "StatusType": "IT"
            }
          }
        ]
      }
    }
  ]
}
```

Mapping to `DelhiveryTrackingResult`:
- If `ShipmentData` has multiple entries, find the element whose `Shipment.AWB` matches the requested `waybill`. If no element matches, treat as `ShipmentData` absent/empty (i.e. return `current_status: "no_data"`, `scans: []`, `waybill` set to the requested value).
- Otherwise use `ShipmentData[0]` as the single entry.
- `waybill` ← `ShipmentData[0].Shipment.AWB`
- `current_status` ← `ShipmentData[0].Shipment.Status.Status` if `ShipmentData` is present and `Status.Status` is non-empty; otherwise `"no_data"`.
- `current_location` ← `ShipmentData[0].Shipment.Status.StatusLocation` (nullable).
- `scans` ← `ShipmentData[0].Shipment.Scans[].ScanDetail` mapped to `DelhiveryScan`; `[]` if absent or empty.
- `fetch_time` ← `new Date().toISOString()` (set by our server at fetch time).

**Precedence rule for `current_status`:**
1. If `ShipmentData` is absent/empty → `"no_data"`.
2. If `ShipmentData[0].Shipment.Status.Status` is a non-empty string → use it (even if `Scans` is empty — Delhivery may return a status without detailed scan entries).
3. If `Status.Status` is absent/empty → `"no_data"`.

`scans` is always an array (may be `[]`). A non-`"no_data"` `current_status` with an empty `scans` array is a valid state and simply means Delhivery has a status update but no detailed scan events yet.

This is always a **200** response — never a 4xx/5xx for empty or "no_data" results.

#### Response envelope (all 200 cases)

```ts
{ data: DelhiveryTrackingResult; cached: boolean }
```

`DelhiveryTrackingResult` always includes all fields (`waybill`, `fetch_time`, `current_status`, `scans`); `scans` may be empty.

#### Error responses
| Condition | Status | Body |
|-----------|--------|------|
| Not admin | 403 | `{ error: "Admin access required" }` |
| Missing waybill | 400 | `{ error: "waybill is required" }` |
| `DELHIVERY_API_TOKEN` not set | 500 | `{ error: "Delhivery integration not configured" }` |
| Delhivery returns 4xx | 502 | `{ error: "Delhivery API error", status: <http_status> }` |
| Delhivery returns 429 | 502 | `{ error: "Delhivery rate limit exceeded" }` |
| Delhivery returns 5xx or timeout | 502 | `{ error: "Delhivery API unavailable" }` |
| Delhivery returns invalid/non-JSON | 502 | `{ error: "Delhivery returned unexpected response" }` |
| Upstash unavailable | fall through to live call | — |

Note: `details` / `status` fields in 502 bodies are typed as `number` (HTTP status code only — no upstream text is forwarded to avoid leaking internal information).

---

## 7. Client Hook — `useDelhiveryTracking`

**File:** `hooks/useDelhiveryTracking.ts`

```ts
interface UseDelhiveryTrackingOptions {
  waybill:    string;
  orderId?:   string;
  enabled:    boolean;
}
```

- Query key: `["admin", "delhivery", "tracking", waybill]`
- Fetcher: `GET /api/admin/shipping/delhivery/tracking?waybill=...&order_id=...` via `useAuthenticatedFetch`.
- `refetchOnWindowFocus: false`
- `refetchInterval`: 90 000ms (90s) while modal is open, only when `enabled`.
- `refetchIntervalInBackground: false` — stops interval when tab blurs.
- `retry: 1` on error.
- Returns: `{ data, isLoading, isFetching, isError, error, refetch, dataUpdatedAt }`.

---

## 8. UI Component — `DelhiveryTrackingPanel`

**File:** `components/admin/DelhiveryTrackingPanel.tsx`

Rendered conditionally inside `OrderDetailModal` when the carrier detection rule passes.

### States

| State | What admin sees |
|-------|----------------|
| Loading (first fetch) | Skeleton rows + spinner |
| Auto-refresh (subsequent) | Stale data visible + small spinner in header |
| Success — has scans | Scan timeline list (newest first) |
| Success — no scans | "No scans yet for this shipment." |
| Error | `Alert` component with message + "Retry" button |
| Carrier ≠ Delhivery | Component not rendered |
| No tracking number | Static note: "Add a tracking number to fetch Delhivery scans." |

### Summary row (from persisted fields — fast, no API call)
- Shown immediately from `order.delhivery_latest_status`, `delhivery_latest_scan_at`, `delhivery_latest_location` when available — before live data arrives.
- Acts as a quick indicator even if Delhivery API is down.

### Timeline list (from live data)
- Collapsible (show top 3 scans by default, "Show all" toggle).
- Each scan row: `[time] · [status] · [location?] · [activity?]`.
- Newest scan at the top.

### Header
- "Delhivery Tracking" label + `Truck` icon.
- `last updated` time stamp ("Last updated N seconds ago").
- Manual `Refresh` button (disabled while fetching).

---

## 9b. Files Changed / Added

| Action | Path |
|--------|------|
| ADD | `database/migrations/add_delhivery_tracking_summary.sql` |
| MODIFY | `lib/types/order.ts` — add 3 optional fields to `Order` |
| ADD | `app/api/admin/shipping/delhivery/tracking/route.ts` |
| ADD | `hooks/useDelhiveryTracking.ts` |
| ADD | `components/admin/DelhiveryTrackingPanel.tsx` |
| MODIFY | `components/admin/OrderManagement.tsx` — mount panel in `OrderDetailModal` |
| MODIFY | `env.template` — add `DELHIVERY_API_TOKEN`, `DELHIVERY_API_BASE_URL` |
| MODIFY | `.env.test.example` — add `DELHIVERY_API_TOKEN`, `DELHIVERY_API_BASE_URL` placeholder for Playwright/CI |

---

## 9a. Error Handling & Edge Cases

- **Rate limit**: 90s cache + `refetchInterval` = at most 1 real Delhivery call per waybill per 90s across all admins. Well within 750/5 min. Note: concurrent cache-miss requests before the first `SET` resolves can still produce parallel Delhivery calls. This is acceptable given our low admin concurrency; a single-flight mechanism is not required for v1.
- **Upstash unavailable**: fall through to live Delhivery call. Do not write to cache on this path. Do not surface a cache error to the admin — they just get slightly higher Delhivery call frequency.
- **Token not configured**: API route returns 500 with a clear message; UI shows a non-alarming "Delhivery integration not configured" message.
- **Delhivery API down / 429 / timeout**: `retry: 1`, then error state with retry button. Persisted summary still visible above the error.
- **Non-Delhivery carrier**: panel not rendered — no API calls made.
- **Modal closed during interval**: `enabled` flips to false, `refetchInterval` stops immediately.
- **Concurrent admins**: Upstash cache deduplicates parallel Delhivery calls by waybill.
- **`order_id` mismatch**: if `orders.tracking_number` does not match `waybill`, skip DB persistence silently and log a warning server-side. The live scan data is still returned.
- **DB persistence failure**: logged server-side but never propagated to the client response.
- **TanStack `orderId` in query key**: `orderId` is intentionally **excluded** from the TanStack query key. The query key is `["admin", "delhivery", "tracking", waybill]` — keyed purely on waybill, since Delhivery data is shipment-scoped, not order-scoped. Multiple orders with the same AWB (edge case) would share the same cached TanStack result, which is correct.

---

## 11. Environment Variables

| Variable | Scope | Description |
|---------|-------|-------------|
| `DELHIVERY_API_TOKEN` | Server-only | Token from Delhivery Business SPOC (never prefix with `NEXT_PUBLIC_`) |
| `DELHIVERY_API_BASE_URL` | Server-only, optional | Defaults to `https://track.delhivery.com`; set to `https://staging-express.delhivery.com` for test |

Add placeholder entries to both `env.template` and `.env.test.example` (the latter is used by Playwright/CI).

---

## 12. Testing Approach

- Unit: pure functions — Delhivery response parser, carrier detection rule.
- Integration: mock Delhivery API (MSW or fetch mock) in route handler tests; test `order_id` mismatch validation path.
- E2E (Playwright, existing suite): verify panel mounts for a shipped Delhivery order; verify it does not mount for non-Delhivery orders; verify `DELHIVERY_API_TOKEN` missing shows configured error message.
