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

  // 3. Token guard — supports both DELHIVERY_API_TOKEN and legacy DELIVERY_API_KEY
  const token =
    process.env.DELHIVERY_API_TOKEN?.trim() ||
    process.env.DELIVERY_API_KEY?.trim();
  if (!token) {
    console.error("Delhivery API token not set (DELHIVERY_API_TOKEN or DELIVERY_API_KEY)");
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

  // 5. Call Delhivery Pull API — supports both DELHIVERY_API_BASE_URL and legacy DELHIVERY_BASE_URL
  const baseUrl =
    process.env.DELHIVERY_API_BASE_URL?.trim() ||
    process.env.DELHIVERY_BASE_URL?.trim() ||
    "https://track.delhivery.com";
  // Correct Delhivery tracking endpoint — path must include /json/
  const url = `${baseUrl}/api/v1/packages/json/?waybill=${encodeURIComponent(waybill)}`;

  let raw: DelhiveryRawResponse;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, {
      headers: {
        Authorization: `Token ${token}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    timeoutId = undefined;

    if (res.status === 403) {
      // Delhivery uses 403 for rate limiting (750 req/5 min per token)
      return NextResponse.json({ error: "Delhivery rate limit exceeded" }, { status: 502 });
    }

    const text = await res.text();

    // HTTP 400 from Delhivery means "waybill not found" — treat as no_data, not an error
    if (res.status === 400) {
      console.info(`Delhivery 400 for waybill ${waybill} — treating as no_data`);
      const noDataResult = { waybill, current_status: "no_data", scans: [], fetch_time: new Date().toISOString() };
      try {
        await UpstashService.set(cacheKey(waybill), noDataResult, CACHE_TTL_SECONDS);
      } catch { /* fail-open */ }
      return NextResponse.json({ data: noDataResult, cached: false });
    }

    if (!res.ok) {
      console.error(`Delhivery API error: status=${res.status}`, text.slice(0, 200));
      return NextResponse.json({ error: "Delhivery API unavailable" }, { status: 502 });
    }

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
    const isTimeout = fetchErr instanceof Error && fetchErr.name === "AbortError";
    return NextResponse.json(
      { error: isTimeout ? "Delhivery request timed out" : "Delhivery API unavailable" },
      { status: 502 }
    );
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
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

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        delhivery_latest_status:   result.current_status,
        delhivery_latest_scan_at:  result.scans[0]?.time ?? null,
        delhivery_latest_location: result.current_location ?? null,
        updated_at:                new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updateError) {
      console.error(`persistSummary: failed to update order ${orderId}:`, updateError.message);
    }
  } catch (err) {
    console.error("persistSummary unexpected error:", err);
  }
}
