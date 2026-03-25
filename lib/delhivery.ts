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

  if (!raw || typeof raw !== "object") return noData();
  if (!Array.isArray(raw.ShipmentData) || raw.ShipmentData.length === 0) return noData();

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
 * Shows whenever carrier is Delhivery AND a tracking number (AWB) is present,
 * regardless of order status — an AWB may exist before status reaches "shipped".
 */
export function isDelhiveryOrder(
  carrierName?: string | null,
  trackingNumber?: string | null,
  _status?: string | null   // reserved for future status-specific logic
): boolean {
  if (!trackingNumber?.trim()) return false;
  return !!carrierName?.toLowerCase().includes("delhivery");
}
