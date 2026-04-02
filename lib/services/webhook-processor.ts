import { createAdminSupabaseClient } from "@/lib/supabase-server";
import { parseDelhiveryWebhookPayload } from "@/lib/services/delhivery-webhook";
import {
  buildNotificationRowsForScan,
  getActiveAdminIds,
  insertNotificationRows,
  MAX_ATTEMPTS,
  nextRetryAt,
  resolveOrderByAwb,
} from "@/lib/services/notification-service";
import type { WebhookEvent } from "@/lib/types/notifications";

const BATCH_SIZE = 50;
const LEASE_TIMEOUT_MINUTES = 10;
const PROCESS_MARK_RETRIES = 3;
const PROCESS_MARK_RETRY_DELAY_MS = 150;
const HEARTBEAT_INTERVAL_MS = 15_000;

export interface ProcessWebhookEventBatchSummary {
  claimed: number;
  processed: number;
  failed: number;
  skipped: number;
}

type ClaimedWebhookEvent = Pick<WebhookEvent, "id" | "awb" | "payload" | "attempt_count">;

export async function processWebhookEventBatch(): Promise<ProcessWebhookEventBatchSummary> {
  const supabase = createAdminSupabaseClient();
  const summary: ProcessWebhookEventBatchSummary = {
    claimed: 0,
    processed: 0,
    failed: 0,
    skipped: 0,
  };

  const nowIso = new Date().toISOString();
  const leaseThresholdIso = new Date(
    Date.now() - LEASE_TIMEOUT_MINUTES * 60 * 1000
  ).toISOString();

  const { data: claimedEvents, error: claimError } = await supabase.rpc("claim_webhook_events", {
    p_batch_size: BATCH_SIZE,
    p_lease_threshold: leaseThresholdIso,
    p_now: nowIso,
  });

  if (claimError) {
    console.error("webhook-processor: failed to claim events", claimError.message);
    return summary;
  }

  if (!Array.isArray(claimedEvents) || claimedEvents.length === 0) {
    return summary;
  }

  const events = claimedEvents as ClaimedWebhookEvent[];
  summary.claimed = events.length;

  let adminIds: string[];
  try {
    adminIds = await getActiveAdminIds();
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Failed to fetch active admins";
    for (const event of events) {
      await markEventFailed(supabase, event.id, normalizeAttemptCount(event.attempt_count) + 1, reason);
      summary.failed += 1;
    }
    return summary;
  }

  if (adminIds.length === 0) {
    for (const event of events) {
      await markEventFailed(
        supabase,
        event.id,
        normalizeAttemptCount(event.attempt_count) + 1,
        "no_admin_recipients"
      );
      summary.failed += 1;
    }
    return summary;
  }

  for (const event of events) {
    try {
      const eventResult = await processSingleEvent(supabase, event, adminIds);

      if (eventResult.skipped) {
        await markEventProcessed(supabase, event.id, null);
        summary.skipped += 1;
      } else {
        await markEventProcessed(supabase, event.id, eventResult.warningNote);
        summary.processed += 1;
      }
    } catch (error) {
      const attemptCount = normalizeAttemptCount(event.attempt_count) + 1;
      const errorMessage = error instanceof Error ? error.message : String(error);
      await markEventFailed(supabase, event.id, attemptCount, errorMessage);
      summary.failed += 1;
    }
  }

  return summary;
}

async function processSingleEvent(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  event: ClaimedWebhookEvent,
  adminIds: string[]
): Promise<{ skipped: boolean; warningNote: string | null }> {
  const { scans } = parseDelhiveryWebhookPayload(event.payload);

  if (scans.length === 0) {
    // Keep malformed/unrecognized payloads from retrying forever.
    return { skipped: true, warningNote: null };
  }

  const warnings: string[] = [];
  const allNotificationRows: ReturnType<typeof buildNotificationRowsForScan> = [];
  let lastHeartbeatAtMs = Date.now();

  for (let index = 0; index < scans.length; index += 1) {
    const scan = scans[index];
    const order = await resolveOrderByAwb(scan.awb);
    if (!order) {
      warnings.push(`WARN_UNMATCHED_AWB:${scan.awb}`);
    }

    allNotificationRows.push(...buildNotificationRowsForScan(scan, adminIds, order));

    if (
      index < scans.length - 1 &&
      shouldHeartbeat(lastHeartbeatAtMs)
    ) {
      await heartbeatProcessingLease(supabase, event.id);
      lastHeartbeatAtMs = Date.now();
    }
  }

  await insertNotificationRows(allNotificationRows);

  const warningNote = warnings.length > 0 ? dedupeWarnings(warnings).join("; ") : null;
  return { skipped: false, warningNote };
}

async function markEventProcessed(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  eventId: string,
  warningNote: string | null
): Promise<void> {
  let lastErrorMessage = "unknown_error";
  for (let attempt = 1; attempt <= PROCESS_MARK_RETRIES; attempt += 1) {
    const { error } = await supabase
      .from("webhook_events")
      .update({
        status: "processed",
        processed_at: new Date().toISOString(),
        next_retry_at: null,
        ...(warningNote ? { last_error: warningNote } : { last_error: null }),
      })
      .eq("id", eventId);

    if (!error) {
      return;
    }

    lastErrorMessage = error.message;
    console.error(
      `webhook-processor: mark processed failed for ${eventId} (attempt ${attempt}/${PROCESS_MARK_RETRIES})`,
      error.message
    );

    if (attempt < PROCESS_MARK_RETRIES) {
      await sleep(PROCESS_MARK_RETRY_DELAY_MS);
    }
  }

  throw new Error(`mark_processed_failed:${lastErrorMessage}`);
}

async function markEventFailed(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  eventId: string,
  attemptCount: number,
  reason: string
): Promise<void> {
  const safeAttemptCount = normalizeAttemptCount(attemptCount);
  const isTerminalFailure = safeAttemptCount >= MAX_ATTEMPTS;

  const updatePayload = isTerminalFailure
    ? {
        status: "failed" as const,
        attempt_count: safeAttemptCount,
        next_retry_at: null,
        last_error: reason,
      }
    : {
        // Compatible with claim_webhook_events SQL: retries are pending + future next_retry_at.
        status: "pending" as const,
        attempt_count: safeAttemptCount,
        next_retry_at: nextRetryAt(safeAttemptCount).toISOString(),
        last_error: reason,
      };

  const { error } = await supabase.from("webhook_events").update(updatePayload).eq("id", eventId);
  if (error) {
    console.error(`webhook-processor: mark failed update failed for ${eventId}`, error.message);
  }
}

function normalizeAttemptCount(attemptCount: unknown): number {
  if (typeof attemptCount !== "number" || !Number.isFinite(attemptCount)) {
    return 0;
  }
  return Math.max(0, Math.floor(attemptCount));
}

function dedupeWarnings(warnings: string[]): string[] {
  return Array.from(new Set(warnings));
}

function shouldHeartbeat(lastHeartbeatAtMs: number): boolean {
  return Date.now() - lastHeartbeatAtMs >= HEARTBEAT_INTERVAL_MS;
}

async function heartbeatProcessingLease(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  eventId: string
): Promise<void> {
  const { error } = await supabase
    .from("webhook_events")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", eventId)
    .eq("status", "processing");

  if (error) {
    throw new Error(`heartbeat_failed:${error.message}`);
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
