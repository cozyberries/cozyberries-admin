import { NextRequest, NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/jwt-auth";
import { createAdminSupabaseClient } from "@/lib/supabase-server";
import type { WebhookMetrics } from "@/lib/types/notifications";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await authenticateRequest(request);
  if (!auth.isAuthenticated || !auth.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const supabase = createAdminSupabaseClient();
    const nowMs = Date.now();

    const [
      pendingCountResult,
      processingCountResult,
      failedCountResult,
      oldestPendingResult,
      lastProcessedResult,
      recentFailuresResult,
    ] = await Promise.all([
      supabase
        .from("webhook_events")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("webhook_events")
        .select("*", { count: "exact", head: true })
        .eq("status", "processing"),
      supabase
        .from("webhook_events")
        .select("*", { count: "exact", head: true })
        .eq("status", "failed"),
      supabase
        .from("webhook_events")
        .select("received_at")
        .eq("status", "pending")
        .order("received_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("webhook_events")
        .select("processed_at")
        .eq("status", "processed")
        .not("processed_at", "is", null)
        .order("processed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("webhook_events")
        .select("id, attempt_count, last_error, updated_at")
        .eq("status", "failed")
        .order("updated_at", { ascending: false })
        .limit(20),
    ]);

    const metricQueryError =
      pendingCountResult.error ??
      processingCountResult.error ??
      failedCountResult.error ??
      oldestPendingResult.error ??
      lastProcessedResult.error ??
      recentFailuresResult.error;

    if (metricQueryError) {
      console.error("webhook-events metrics query failed", metricQueryError.message);
      return NextResponse.json({ error: "Failed to load webhook metrics" }, { status: 500 });
    }

    const oldestPendingReceivedAt = oldestPendingResult.data?.received_at ?? null;
    const oldestPendingAgeSeconds =
      oldestPendingReceivedAt === null
        ? null
        : Math.max(
            0,
            Math.floor((nowMs - new Date(oldestPendingReceivedAt).getTime()) / 1000)
          );

    const metrics: WebhookMetrics = {
      pending_count: pendingCountResult.count ?? 0,
      processing_count: processingCountResult.count ?? 0,
      failed_count: failedCountResult.count ?? 0,
      oldest_pending_age_seconds: oldestPendingAgeSeconds,
      last_processed_at: lastProcessedResult.data?.processed_at ?? null,
      recent_failures:
        recentFailuresResult.data?.map((row) => ({
          id: row.id,
          attempt_count: row.attempt_count,
          last_error: row.last_error,
          updated_at: row.updated_at,
        })) ?? [],
    };

    return NextResponse.json({ metrics }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("webhook-events metrics route failed", message);
    return NextResponse.json({ error: "Failed to load webhook metrics" }, { status: 500 });
  }
}
