import type {
  DelhiveryWebhookPayload,
  DelhiveryWebhookScan,
} from "@/lib/types/notifications";

export interface ParsedWebhookScan {
  awb: string;
  status: string;
  status_type: string | null;
  status_datetime: string;
  status_location: string | null;
  instructions: string | null;
  pickup_date: string | null;
  reference_no: string | null;
}

export interface ParsedWebhookResult {
  scans: ParsedWebhookScan[];
  raw_awb: string | null;
}

/**
 * Parse and normalize a Delhivery webhook payload into a deterministic shape.
 * Supports:
 * 1) { scans: DelhiveryWebhookScan[] }
 * 2) flat single scan object with AWB/Status/StatusDateTime
 *
 * This parser never throws. Unknown/invalid payloads become an empty result.
 */
export function parseDelhiveryWebhookPayload(body: unknown): ParsedWebhookResult {
  if (!isObjectRecord(body)) {
    return emptyResult();
  }

  const payload = body as DelhiveryWebhookPayload;

  if (hasScanArrayPayload(payload)) {
    const scans = payload.scans.filter(isValidScan).map(normalizeScan);
    return {
      scans,
      raw_awb: scans[0]?.awb ?? null,
    };
  }

  if (isValidScan(payload)) {
    const scan = normalizeScan(payload);
    return {
      scans: [scan],
      raw_awb: scan.awb,
    };
  }

  return emptyResult();
}

function emptyResult(): ParsedWebhookResult {
  return {
    scans: [],
    raw_awb: null,
  };
}

function hasScanArrayPayload(payload: unknown): payload is { scans: unknown[] } {
  return isObjectRecord(payload) && Array.isArray(payload.scans);
}

function isValidScan(value: unknown): value is DelhiveryWebhookScan {
  if (!isObjectRecord(value)) {
    return false;
  }

  const awb = readNonEmptyString(value.AWB);
  const status = readNonEmptyString(value.Status);
  const statusDateTime = readNonEmptyString(value.StatusDateTime);

  return awb !== null && status !== null && statusDateTime !== null;
}

function normalizeScan(scan: DelhiveryWebhookScan): ParsedWebhookScan {
  return {
    awb: readNonEmptyString(scan.AWB) ?? "",
    status: readNonEmptyString(scan.Status) ?? "",
    status_type: readNonEmptyString(scan.StatusType),
    status_datetime: readNonEmptyString(scan.StatusDateTime) ?? "",
    status_location: readNonEmptyString(scan.StatusLocation),
    instructions: readNonEmptyString(scan.Instructions),
    pickup_date: readNonEmptyString(scan.PickUpDate),
    reference_no: readNonEmptyString(scan.ReferenceNo),
  };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}
