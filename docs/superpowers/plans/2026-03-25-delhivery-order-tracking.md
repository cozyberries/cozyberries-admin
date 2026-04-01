# Delhivery Order Tracking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add live Delhivery shipment scan tracking inside the admin Order Details modal, with server-side caching and a small persisted status summary on the orders table.

**Architecture:** A new admin-only Next.js Route Handler (`/api/admin/shipping/delhivery/tracking`) proxies the Delhivery Pull API, caches responses in Upstash (90s TTL), and optionally persists a 3-field summary onto the `orders` row. A new `DelhiveryTrackingPanel` client component powered by a TanStack Query hook renders inside the existing `OrderDetailModal`, auto-fetching on open and refreshing every 90s while the modal is open.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (Postgres), Upstash Redis (`UpstashService`), TanStack Query v5, shadcn/ui, Tailwind CSS, Lucide icons, custom JWT auth (`lib/jwt-auth.ts`).

**Spec:** `docs/superpowers/specs/2026-03-25-delhivery-order-tracking-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| ADD | `database/migrations/add_delhivery_tracking_summary.sql` | DB migration — 3 new columns on `orders` |
| MODIFY | `lib/types/order.ts` | Add 3 optional Delhivery fields to `Order` interface |
| ADD | `lib/types/delhivery.ts` | `DelhiveryScan`, `DelhiveryTrackingResult`, raw API shape types |
| ADD | `lib/delhivery.ts` | Pure parser: raw Delhivery JSON → `DelhiveryTrackingResult` |
| ADD | `app/api/admin/shipping/delhivery/tracking/route.ts` | Route handler: auth, cache, Delhivery call, persistence |
| ADD | `hooks/useDelhiveryTracking.ts` | TanStack Query hook — fetches tracking, controls interval |
| ADD | `components/admin/DelhiveryTrackingPanel.tsx` | UI panel: skeleton, timeline, error, persisted summary |
| MODIFY | `components/admin/OrderManagement.tsx` | Mount `DelhiveryTrackingPanel` in `OrderDetailModal` |
| MODIFY | `env.template` | Add `DELHIVERY_API_TOKEN`, `DELHIVERY_API_BASE_URL` |
| MODIFY | `.env.test.example` | Add same vars as CI placeholders |

---

## Task 1: DB Migration + Type Updates

**Files:**
- Create: `database/migrations/add_delhivery_tracking_summary.sql`
- Modify: `lib/types/order.ts`
- Create: `lib/types/delhivery.ts`

### Background

The `orders` table needs 3 new nullable columns for the persisted summary. The `Order` TypeScript interface must match. We also define the runtime-only types for Delhivery scan data in a dedicated file so they can be shared between the route handler and (later) the UI.

- [ ] **Step 1: Write the migration SQL**

Create `database/migrations/add_delhivery_tracking_summary.sql`:

```sql
-- Add Delhivery tracking summary columns to orders table
-- These store only the latest status snapshot (not full scan history).
-- Applied via Supabase Dashboard SQL Editor or: supabase db execute --file database/migrations/add_delhivery_tracking_summary.sql

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delhivery_latest_status    TEXT,
  ADD COLUMN IF NOT EXISTS delhivery_latest_scan_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delhivery_latest_location  TEXT;
```

- [ ] **Step 2: Apply the migration in Supabase**

Go to your Supabase project → SQL Editor → paste the migration → Run.
Verify: `SELECT column_name FROM information_schema.columns WHERE table_name = 'orders' AND column_name LIKE 'delhivery%';`
Expected: 3 rows returned.

- [ ] **Step 3: Add Delhivery types**

Create `lib/types/delhivery.ts`:

```typescript
// Runtime-only types for Delhivery tracking — never persisted in full.

export interface DelhiveryScan {
  time:      string;   // ScanDateTime from Delhivery
  status:    string;   // Scan field — e.g. "In Transit", "Delivered"
  location?: string;   // ScannedLocation
  activity?: string;   // Instructions / remarks
}

export interface DelhiveryTrackingResult {
  waybill:           string;
  current_status:    string; // "no_data" when Delhivery has nothing
  current_location?: string;
  scans:             DelhiveryScan[];
  fetch_time:        string; // ISO timestamp — set by our server
}

// Raw shape returned by the Delhivery Pull API
export interface DelhiveryRawScanDetail {
  ScanDateTime:    string;
  Scan:            string;
  ScannedLocation?: string;
  Instructions?:   string;
  StatusType?:     string;
}

export interface DelhiveryRawStatus {
  Status:          string;
  StatusLocation?: string;
  StatusDateTime?: string;
  Instructions?:   string;
  StatusType?:     string;
}

export interface DelhiveryRawShipment {
  AWB:    string;
  Status: DelhiveryRawStatus;
  Scans?: { ScanDetail: DelhiveryRawScanDetail }[];
}

export interface DelhiveryRawResponse {
  ShipmentData?: { Shipment: DelhiveryRawShipment }[];
}
```

- [ ] **Step 4: Extend Order interface**

In `lib/types/order.ts`, add to the `Order` interface (after `delivery_notes`):

```typescript
  delhivery_latest_status?:   string;
  delhivery_latest_scan_at?:  string;
  delhivery_latest_location?: string;
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add database/migrations/add_delhivery_tracking_summary.sql lib/types/order.ts lib/types/delhivery.ts
git commit -m "feat: add Delhivery tracking summary columns and types"
```

---

## Task 2: Delhivery Response Parser

**Files:**
- Create: `lib/delhivery.ts`

### Background

Isolating the parsing logic in a pure function makes it testable without HTTP or DB. The parser accepts raw Delhivery JSON and returns our normalised `DelhiveryTrackingResult`. All edge cases (missing `ShipmentData`, empty `Scans`, multi-shipment AWB matching) are handled here.

- [ ] **Step 1: Create the parser**

Create `lib/delhivery.ts`:

```typescript
import type {
  DelhiveryRawResponse,
  DelhiveryTrackingResult,
  DelhiveryScan,
} from "@/lib/types/delhivery";

const NO_DATA_STATUS = "no_data";

/**
 * Parse a raw Delhivery Pull API response into our normalised shape.
 * Always returns a valid DelhiveryTrackingResult — never throws.
 */
export function parseDelhiveryResponse(
  raw: DelhiveryRawResponse,
  requestedWaybill: string
): DelhiveryTrackingResult {
  const fetch_time = new Date().toISOString();
  const noData = (): DelhiveryTrackingResult => ({
    waybill: requestedWaybill,
    current_status: NO_DATA_STATUS,
    scans: [],
    fetch_time,
  });

  if (!raw.ShipmentData || raw.ShipmentData.length === 0) return noData();

  // Per spec: find the entry whose AWB matches the requested waybill.
  // If none match, treat as absent (no_data) — do NOT fall back to ShipmentData[0].
  const entry = raw.ShipmentData.length === 1
    ? raw.ShipmentData[0]
    : raw.ShipmentData.find((s) => s.Shipment?.AWB === requestedWaybill);

  if (!entry?.Shipment) return noData();

  const { Shipment } = entry;
  const waybill = Shipment.AWB ?? requestedWaybill;

  // current_status precedence: use Status.Status if non-empty, else "no_data"
  const current_status = Shipment.Status?.Status?.trim() || NO_DATA_STATUS;
  const current_location = Shipment.Status?.StatusLocation?.trim() || undefined;

  // Defensively filter out any scan entries missing ScanDetail fields
  const scans: DelhiveryScan[] = (Shipment.Scans ?? [])
    .filter((s) => s?.ScanDetail?.ScanDateTime && s?.ScanDetail?.Scan)
    .map((s) => ({
      time:     s.ScanDetail.ScanDateTime,
      status:   s.ScanDetail.Scan,
      location: s.ScanDetail.ScannedLocation?.trim() || undefined,
      activity: s.ScanDetail.Instructions?.trim() || undefined,
    }));

  // Newest scan first
  scans.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return { waybill, current_status, current_location, scans, fetch_time };
}

/**
 * Check whether an order should show the Delhivery tracking panel.
 * Matches the carrier detection rule from spec §4.2.
 */
export function isDelhiveryOrder(
  carrierName?: string | null,
  trackingNumber?: string | null,
  status?: string | null
): boolean {
  if (!trackingNumber?.trim()) return false;
  if (!carrierName?.toLowerCase().includes("delhivery")) return false;
  return status === "shipped" || status === "delivered";
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/delhivery.ts
git commit -m "feat: add Delhivery response parser and carrier detection helper"
```

---

## Task 3: Server Route Handler

**Files:**
- Create: `app/api/admin/shipping/delhivery/tracking/route.ts`
- Modify: `env.template`
- Modify: `.env.test.example`

### Background

The route handler is admin-only, proxies the Delhivery Pull API, caches via `UpstashService.get/set`, and optionally persists a 3-field summary to the `orders` row. The Delhivery API token lives only on the server (`DELHIVERY_API_TOKEN`).

- [ ] **Step 1: Create the route handler**

Create `app/api/admin/shipping/delhivery/tracking/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwt-auth";
import { UpstashService } from "@/lib/upstash";
import { createAdminSupabaseClient } from "@/lib/supabase-server";
import { parseDelhiveryResponse } from "@/lib/delhivery";
import type { DelhiveryRawResponse, DelhiveryTrackingResult } from "@/lib/types/delhivery";

const CACHE_TTL_SECONDS = 90;

function cacheKey(waybill: string): string {
  return `delhivery:track:${waybill}`;
}

export async function GET(request: NextRequest) {
  // 1. Auth
  const auth = await authenticateRequest(request);
  if (!auth.isAuthenticated || !auth.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  // 2. Validate query params
  const { searchParams } = request.nextUrl;
  const waybill = searchParams.get("waybill")?.trim();
  const orderId = searchParams.get("order_id")?.trim() || undefined;

  if (!waybill) {
    return NextResponse.json({ error: "waybill is required" }, { status: 400 });
  }

  // 3. Token guard
  const token = process.env.DELHIVERY_API_TOKEN;
  if (!token) {
    console.error("DELHIVERY_API_TOKEN is not set");
    return NextResponse.json(
      { error: "Delhivery integration not configured" },
      { status: 500 }
    );
  }

  // 4. Cache lookup (fail-open: if Upstash errors, fall through to live call)
  try {
    const cached = await UpstashService.get(cacheKey(waybill));
    if (cached) {
      return NextResponse.json({ data: cached as DelhiveryTrackingResult, cached: true });
    }
  } catch (cacheErr) {
    console.warn("Upstash cache read failed, falling through to Delhivery:", cacheErr);
  }

  // 5. Call Delhivery Pull API
  const baseUrl =
    process.env.DELHIVERY_API_BASE_URL ?? "https://track.delhivery.com";
  const url = `${baseUrl}/api/v1/packages/?waybill=${encodeURIComponent(waybill)}`;

  let raw: DelhiveryRawResponse;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, {
      headers: { Authorization: `Token ${token}` },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.status === 429) {
      return NextResponse.json({ error: "Delhivery rate limit exceeded" }, { status: 502 });
    }
    if (res.status >= 400 && res.status < 500) {
      return NextResponse.json(
        { error: "Delhivery API error", status: res.status },
        { status: 502 }
      );
    }
    if (!res.ok) {
      return NextResponse.json({ error: "Delhivery API unavailable" }, { status: 502 });
    }

    const text = await res.text();
    try {
      raw = JSON.parse(text) as DelhiveryRawResponse;
    } catch {
      console.error("Delhivery returned non-JSON:", text.slice(0, 200));
      return NextResponse.json(
        { error: "Delhivery returned unexpected response" },
        { status: 502 }
      );
    }
  } catch (fetchErr) {
    const isTimeout =
      fetchErr instanceof Error && fetchErr.name === "AbortError";
    return NextResponse.json(
      { error: isTimeout ? "Delhivery API unavailable" : "Delhivery API unavailable" },
      { status: 502 }
    );
  }

  // 6. Parse response
  const result = parseDelhiveryResponse(raw, waybill);

  // 7. Cache result (fail-open)
  try {
    await UpstashService.set(cacheKey(waybill), result, CACHE_TTL_SECONDS);
  } catch (cacheErr) {
    console.warn("Upstash cache write failed:", cacheErr);
  }

  // 8. Persist summary to orders row (fire-and-forget, guarded)
  if (orderId) {
    persistSummary(orderId, waybill, result).catch((err) =>
      console.error("Failed to persist Delhivery summary:", err)
    );
  }

  return NextResponse.json({ data: result, cached: false });
}

async function persistSummary(
  orderId: string,
  waybill: string,
  result: DelhiveryTrackingResult
): Promise<void> {
  try {
    const supabase = createAdminSupabaseClient();

    // Verify order exists and waybill + carrier match before writing
    const { data: order, error } = await supabase
      .from("orders")
      .select("tracking_number, carrier_name, status")
      .eq("id", orderId)
      .single();

    if (error || !order) {
      console.warn(`persistSummary: order ${orderId} not found`);
      return;
    }

    if (order.tracking_number !== waybill) {
      console.warn(
        `persistSummary: waybill mismatch for order ${orderId} (stored: ${order.tracking_number}, requested: ${waybill})`
      );
      return;
    }

    if (!order.carrier_name?.toLowerCase().includes("delhivery")) {
      console.warn(
        `persistSummary: carrier_name "${order.carrier_name}" does not include "delhivery" for order ${orderId}`
      );
      return;
    }

    if (order.status !== "shipped" && order.status !== "delivered") {
      return; // Only persist for relevant statuses
    }

    if (result.current_status === "no_data") return; // Nothing useful to persist

    await supabase
      .from("orders")
      .update({
        delhivery_latest_status:   result.current_status,
        delhivery_latest_scan_at:  result.scans[0]?.time ?? null,
        delhivery_latest_location: result.current_location ?? null,
        updated_at:                new Date().toISOString(),
      })
      .eq("id", orderId);
  } catch (err) {
    console.error("persistSummary unexpected error:", err);
  }
}
```

- [ ] **Step 2: Add env var placeholders**

In `env.template`, append:

```
# Delhivery Shipping Integration
DELHIVERY_API_TOKEN=your-delhivery-api-token-from-business-spoc
# Optional: defaults to https://track.delhivery.com; use https://staging-express.delhivery.com for test
DELHIVERY_API_BASE_URL=
```

In `.env.test.example`, append:

```
# Delhivery (leave blank to test the "not configured" error path)
DELHIVERY_API_TOKEN=
DELHIVERY_API_BASE_URL=https://staging-express.delhivery.com
```

- [ ] **Step 3: Add `DELHIVERY_API_TOKEN` to your local `.env.local`**

```
DELHIVERY_API_TOKEN=<your token from Delhivery Business SPOC>
DELHIVERY_API_BASE_URL=https://staging-express.delhivery.com
```

(Use staging URL for local dev until you go live.)

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Smoke-test the route manually**

Start the dev server:

```bash
npm run dev
```

Call the route (replace `<JWT>` with a valid admin JWT from your browser's storage):

```bash
curl -H "Authorization: Bearer <JWT>" \
  "http://localhost:4000/api/admin/shipping/delhivery/tracking?waybill=TEST123"
```

Expected (token misconfigured locally): `{"error":"Delhivery integration not configured"}` or a live Delhivery response / `no_data`.

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/shipping/delhivery/tracking/route.ts env.template .env.test.example
git commit -m "feat: add Delhivery tracking proxy route handler"
```

---

## Task 4: Client Hook — `useDelhiveryTracking`

**Files:**
- Create: `hooks/useDelhiveryTracking.ts`

### Background

The hook wraps TanStack Query to fetch from our proxy route, controls auto-fetch + interval, and wires up `useAuthenticatedFetch` for consistent auth header handling.

- [ ] **Step 1: Create the hook**

Create `hooks/useDelhiveryTracking.ts`:

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/hooks/useAuthenticatedFetch";
import type { DelhiveryTrackingResult } from "@/lib/types/delhivery";

interface UseDelhiveryTrackingOptions {
  waybill:  string;
  orderId?: string;
  enabled:  boolean;
}

interface DelhiveryTrackingResponse {
  data:   DelhiveryTrackingResult;
  cached: boolean;
}

export function useDelhiveryTracking({
  waybill,
  orderId,
  enabled,
}: UseDelhiveryTrackingOptions) {
  const { get } = useAuthenticatedFetch();

  return useQuery<DelhiveryTrackingResponse, Error>({
    queryKey: ["admin", "delhivery", "tracking", waybill],
    queryFn: async () => {
      const params = new URLSearchParams({ waybill });
      if (orderId) params.set("order_id", orderId);
      const res = await get(
        `/api/admin/shipping/delhivery/tracking?${params}`,
        { requireAdmin: true }
      );
      return res.json() as Promise<DelhiveryTrackingResponse>;
    },
    enabled: enabled && !!waybill,
    refetchOnWindowFocus: false,
    refetchInterval: enabled ? 90_000 : false,
    refetchIntervalInBackground: false,
    retry: 1,
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add hooks/useDelhiveryTracking.ts
git commit -m "feat: add useDelhiveryTracking TanStack Query hook"
```

---

## Task 5: `DelhiveryTrackingPanel` UI Component

**Files:**
- Create: `components/admin/DelhiveryTrackingPanel.tsx`

### Background

The panel renders inside `OrderDetailModal`. It shows a persisted summary row immediately (from `order` props), then replaces/augments it with live data once the query resolves. Handles all states: loading skeleton, live timeline, no-scans, error + retry.

- [ ] **Step 1: Create the panel component**

Create `components/admin/DelhiveryTrackingPanel.tsx`:

```typescript
"use client";

import React, { useState } from "react";
import { Truck, RefreshCw, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useDelhiveryTracking } from "@/hooks/useDelhiveryTracking";
import type { Order } from "@/lib/types/order";
import type { DelhiveryScan } from "@/lib/types/delhivery";

interface DelhiveryTrackingPanelProps {
  order: Order;
}

function formatRelativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

function formatScanTime(time: string): string {
  return new Date(time).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ScanRow({ scan }: { scan: DelhiveryScan }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-400" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-800">{scan.status}</p>
        <p className="text-xs text-gray-500">
          {formatScanTime(scan.time)}
          {scan.location ? ` · ${scan.location}` : ""}
        </p>
        {scan.activity && (
          <p className="text-xs text-gray-400 italic">{scan.activity}</p>
        )}
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-start gap-3 py-2 animate-pulse">
      <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-gray-200" />
      <div className="flex-1 space-y-1">
        <div className="h-3 w-32 rounded bg-gray-200" />
        <div className="h-3 w-48 rounded bg-gray-100" />
      </div>
    </div>
  );
}

export default function DelhiveryTrackingPanel({ order }: DelhiveryTrackingPanelProps) {
  const [showAll, setShowAll] = useState(false);

  const { data, isLoading, isFetching, isError, error, refetch, dataUpdatedAt } =
    useDelhiveryTracking({
      waybill:  order.tracking_number!,
      orderId:  order.id,
      enabled:  true,
    });

  const result        = data?.data;
  const scans         = result?.scans ?? [];
  const visibleScans  = showAll ? scans : scans.slice(0, 3);
  const hasMoreScans  = scans.length > 3;

  // Persisted summary (shown before live data arrives)
  const persistedStatus   = order.delhivery_latest_status;
  const persistedScanAt   = order.delhivery_latest_scan_at;
  const persistedLocation = order.delhivery_latest_location;
  const hasPersisted = !!persistedStatus;

  const liveStatus   = result?.current_status;
  const liveLocation = result?.current_location;
  const displayStatus   = liveStatus   ?? persistedStatus;
  const displayLocation = liveLocation ?? persistedLocation;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
          <Truck className="h-3 w-3" /> Delhivery Tracking
        </p>
        <div className="flex items-center gap-2">
          {dataUpdatedAt > 0 && (
            <span className="text-xs text-gray-400">
              {formatRelativeTime(new Date(dataUpdatedAt).toISOString())}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Refresh tracking"
          >
            <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Persisted summary (quick, shown before live data) */}
      {hasPersisted && !result && (
        <div className="rounded-md bg-indigo-50 px-3 py-2 text-xs text-indigo-700 space-y-0.5">
          <p className="font-medium">{persistedStatus}</p>
          {persistedLocation && <p className="text-indigo-500">{persistedLocation}</p>}
          {persistedScanAt && (
            <p className="text-indigo-400">
              Last scan: {formatScanTime(persistedScanAt)}
            </p>
          )}
        </div>
      )}

      {/* Loading skeleton + spinner on first fetch */}
      {isLoading && !hasPersisted && (
        <div className="divide-y divide-gray-50 rounded-lg border px-3">
          <div className="flex items-center gap-2 py-2">
            <RefreshCw className="h-3 w-3 animate-spin text-gray-400" />
            <span className="text-xs text-gray-400">Loading tracking…</span>
          </div>
          <SkeletonRow />
          <SkeletonRow />
        </div>
      )}

      {/* Error state */}
      {isError && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-2 text-xs">
            <span>{error?.message ?? "Failed to load tracking"}</span>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Live status banner */}
      {result && displayStatus && displayStatus !== "no_data" && (
        <div className="rounded-md bg-indigo-50 px-3 py-2 text-xs text-indigo-700 space-y-0.5">
          <p className="font-medium">{displayStatus}</p>
          {displayLocation && <p className="text-indigo-500">{displayLocation}</p>}
        </div>
      )}

      {/* No scans */}
      {result && scans.length === 0 && !isError && (
        <p className="text-xs text-gray-400 italic">No scans yet for this shipment.</p>
      )}

      {/* Scan timeline */}
      {scans.length > 0 && (
        <div className="divide-y divide-gray-50 rounded-lg border px-3">
          {visibleScans.map((scan, i) => (
            <ScanRow key={`${scan.time}-${i}`} scan={scan} />
          ))}
          {hasMoreScans && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="flex w-full items-center justify-center gap-1 py-2 text-xs text-gray-500 hover:text-gray-700"
            >
              {showAll ? (
                <><ChevronUp className="h-3 w-3" /> Show less</>
              ) : (
                <><ChevronDown className="h-3 w-3" /> Show all {scans.length} scans</>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript + lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/admin/DelhiveryTrackingPanel.tsx
git commit -m "feat: add DelhiveryTrackingPanel UI component"
```

---

## Task 6: Wire Panel into `OrderDetailModal`

**Files:**
- Modify: `components/admin/OrderManagement.tsx`

### Background

The `OrderDetailModal` already has a Tracking section (lines ~284–336). We mount `DelhiveryTrackingPanel` directly beneath it, conditionally using `isDelhiveryOrder`. The existing manual tracking fields remain unchanged for non-Delhivery carriers.

- [ ] **Step 1: Add imports at the top of `OrderManagement.tsx`**

After the existing imports, add:

```typescript
import { isDelhiveryOrder } from "@/lib/delhivery";
import DelhiveryTrackingPanel from "@/components/admin/DelhiveryTrackingPanel";
```

- [ ] **Step 2: Mount the panel inside `OrderDetailModal`**

In the `OrderDetailModal` component, locate the closing `</div>` of the Tracking section (around line 336 — the block that ends with `{!order.tracking_number && ... "No tracking info yet"}`).

Directly after that closing `</div>` of the tracking block, add:

```typescript
          {/* Delhivery live tracking */}
          {isDelhiveryOrder(order.carrier_name, order.tracking_number, order.status) && (
            <DelhiveryTrackingPanel order={order} />
          )}
          {/* "Add tracking number" nudge — shown when carrier is Delhivery but no AWB set */}
          {(order.status === "shipped" || order.status === "delivered") &&
            order.carrier_name?.toLowerCase().includes("delhivery") &&
            !order.tracking_number && (
            <p className="text-xs text-gray-400 italic">
              Add a tracking number to fetch Delhivery scans.
            </p>
          )}
```

- [ ] **Step 3: Verify TypeScript + lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: no errors.

- [ ] **Step 4: Manual smoke test in the browser**

1. Start dev server: `npm run dev`
2. Navigate to `http://localhost:4000/orders`
3. Open any order where `carrier_name` = "Delhivery", status = "shipped" or "delivered", and `tracking_number` is set.
4. Verify the "Delhivery Tracking" panel appears with a loading skeleton, then resolves (or shows an error if your token is in staging mode).
5. Open an order with a different carrier — verify the panel does NOT appear.

- [ ] **Step 5: Commit**

```bash
git add components/admin/OrderManagement.tsx
git commit -m "feat: mount DelhiveryTrackingPanel in OrderDetailModal"
```

---

## Task 7: Final Integration Check + Linting

- [ ] **Step 1: Full build check**

```bash
npm run build
```

Expected: build completes with no TypeScript or lint errors.

- [ ] **Step 2: Run existing Playwright tests**

```bash
npm test
```

Expected: all existing tests pass (no regressions). The new panel is not covered by E2E tests yet — that is acceptable for v1 per the spec's testing notes.

- [ ] **Step 3: Review `.env.local` has the required vars**

Confirm `DELHIVERY_API_TOKEN` and optionally `DELHIVERY_API_BASE_URL` are set. Without them the panel shows "Delhivery integration not configured" — which is the correct error state.

- [ ] **Step 4: Final commit (only if there are uncommitted changes)**

```bash
git status  # review what remains uncommitted
# If the tree is clean, skip this commit — all changes were committed in prior tasks.
# Only commit if there are genuine untracked/modified files left:
# git add <specific files>
# git commit -m "chore: finalize Delhivery order tracking integration"
```

---

## Post-Implementation: Apply DB Migration to Production

Before deploying to Vercel, run the migration against your **production** Supabase project:

1. Open Supabase Dashboard → your production project → SQL Editor.
2. Paste contents of `database/migrations/add_delhivery_tracking_summary.sql`.
3. Click Run.
4. Add `DELHIVERY_API_TOKEN` (production token) and `DELHIVERY_API_BASE_URL=https://track.delhivery.com` to Vercel environment variables.
5. Deploy.
