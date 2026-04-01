import "server-only";

import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { parseDelhiveryWebhookPayload } from "@/lib/services/delhivery-webhook";
import { createAdminSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 1_048_576; // 1MB

async function readBodyWithLimit(
  request: NextRequest,
  maxBytes: number
): Promise<{ ok: true; rawBody: string } | { ok: false; status: 400 | 413; error: string }> {
  const bodyStream = request.body;
  if (!bodyStream) {
    return { ok: false, status: 400, error: "Request body is required" };
  }

  const reader = bodyStream.getReader();
  const decoder = new TextDecoder("utf-8");
  const chunks: string[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      return { ok: false, status: 413, error: "Payload too large" };
    }

    chunks.push(decoder.decode(value, { stream: true }));
  }

  chunks.push(decoder.decode());
  return { ok: true, rawBody: chunks.join("") };
}

function constantTimeEqual(provided: string, expected: string): boolean {
  try {
    const providedBuffer = Buffer.from(provided);
    const expectedBuffer = Buffer.from(expected);

    if (providedBuffer.length !== expectedBuffer.length) {
      const normalizedProvided = Buffer.alloc(expectedBuffer.length);
      providedBuffer.copy(normalizedProvided, 0, 0, Math.min(providedBuffer.length, expectedBuffer.length));
      timingSafeEqual(normalizedProvided, expectedBuffer);
      return false;
    }

    return timingSafeEqual(providedBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const providedTokenHeader = request.headers.get("x-delhivery-token");
  if (providedTokenHeader === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expectedToken = process.env.DELHIVERY_WEBHOOK_TOKEN?.trim();
  if (!expectedToken) {
    console.error("DELHIVERY_WEBHOOK_TOKEN is not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const providedToken = providedTokenHeader.trim();
  if (!constantTimeEqual(providedToken, expectedToken)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader !== null) {
    const contentLength = Number.parseInt(contentLengthHeader, 10);
    if (!Number.isFinite(contentLength) || contentLength < 0) {
      return NextResponse.json({ error: "Invalid Content-Length header" }, { status: 400 });
    }

    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
  }

  const bodyRead = await readBodyWithLimit(request, MAX_BODY_BYTES);
  if (!bodyRead.ok) {
    return NextResponse.json({ error: bodyRead.error }, { status: bodyRead.status });
  }

  const rawBody = bodyRead.rawBody;

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid payload shape" }, { status: 400 });
  }

  const parsedPayload = parseDelhiveryWebhookPayload(body);
  if (parsedPayload.scans.length === 0) {
    return NextResponse.json({ error: "Invalid payload shape" }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("webhook_events").insert({
    source: "delhivery",
    event_type: "shipment_scan",
    awb: parsedPayload.raw_awb,
    payload: body,
    status: "pending",
    received_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Failed to insert webhook event", error.message);
    return NextResponse.json({ error: "Failed to persist event" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 202 });
}
