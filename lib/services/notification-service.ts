import { createAdminSupabaseClient } from "@/lib/supabase-server";
import type { ParsedWebhookScan } from "@/lib/services/delhivery-webhook";
import type { NotificationMeta } from "@/lib/types/notifications";
import type { OrderStatus, PaymentStatus } from "@/lib/types/order";

export const MAX_ATTEMPTS = 10;
// Exponential backoff caps in minutes: 1, 5, 15, 60, 60, ...
const BACKOFF_MINUTES = [1, 5, 15, 60, 60, 60, 60, 60, 60, 60];
type NotificationInsertRow = {
  user_id: string | null;
  title: string;
  message: string;
  type: "shipping_scan" | "order_status" | "payment_status";
  read: boolean;
  meta: NotificationMeta;
};

/**
 * Calculate next retry time based on attempt count (1-indexed).
 */
export function nextRetryAt(attemptCount: number): Date {
  const safeAttemptCount = Number.isFinite(attemptCount)
    ? Math.max(1, Math.floor(attemptCount))
    : 1;
  const minutesIndex = Math.min(safeAttemptCount - 1, BACKOFF_MINUTES.length - 1);
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
  const normalizedAwb = awb.trim();
  if (!normalizedAwb) {
    return null;
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number")
    .eq("tracking_number", normalizedAwb)
    .maybeSingle();

  if (error) {
    throw new Error(`resolveOrderByAwb failed for AWB ${normalizedAwb}: ${error.message}`);
  }

  return data ?? null;
}

/**
 * Create one notification row per admin user for a given scan.
 * Throws on failure so caller can retry.
 */
export async function createNotificationsForScan(
  scan: ParsedWebhookScan,
  adminIds: string[],
  order: { id: string; order_number: string } | null
): Promise<void> {
  const rows = buildNotificationRowsForScan(scan, adminIds, order);
  await insertNotificationRows(rows);
}

export function buildNotificationRowsForScan(
  scan: ParsedWebhookScan,
  adminIds: string[],
  order: { id: string; order_number: string } | null
): NotificationInsertRow[] {
  if (adminIds.length === 0) {
    throw new Error("no_admin_recipients");
  }

  const location = scan.status_location ? ` at ${scan.status_location}` : "";
  const orderLabel = order ? `Order ${order.order_number}` : `AWB ${scan.awb}`;
  const title = `Shipment scan: ${scan.status}`;
  const message = `${orderLabel}${location} at ${formatScanDateTime(scan.status_datetime)}`;

  const meta: NotificationMeta = {
    awb: scan.awb,
    scan_status: scan.status,
    scan_location: scan.status_location ?? undefined,
    scan_time: scan.status_datetime,
    ...(order ? { order_id: order.id, order_number: order.order_number } : {}),
  };

  // Use null user_id (broadcast) — visible to every admin via the OR-null filter.
  // Avoids mismatches between admin_users.id and the JWT userId in user_profiles.
  void adminIds; // recipient check already guards against zero admins above
  return [{
    user_id: null,
    title,
    message,
    type: "shipping_scan" as const,
    read: false,
    meta,
  }];
}

export async function insertNotificationRows(rows: NotificationInsertRow[]): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("notifications").insert(rows);

  if (error) {
    throw new Error(`Notification insert failed: ${error.message}`);
  }
}

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  payment_pending: "Payment pending",
  payment_confirmed: "Payment confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
};

function orderStatusLabel(status: OrderStatus): string {
  return ORDER_STATUS_LABEL[status] ?? status;
}

function paymentStatusLabel(status: PaymentStatus): string {
  return PAYMENT_STATUS_LABEL[status] ?? status;
}

function formatMoney(amount: number, currency: string | null | undefined): string {
  const c = (currency ?? "INR").toUpperCase();
  if (c === "INR") {
    return `₹${amount.toFixed(2)}`;
  }
  return `${amount.toFixed(2)} ${c}`;
}

/**
 * Notify all active admins when a new order is created (best-effort; logs on failure).
 */
export async function notifyAdminsOrderPlaced(order: {
  id: string;
  order_number: string;
  status: OrderStatus;
  total_amount: number;
  currency?: string | null;
  customer_email?: string | null;
  customer_name?: string | null;
}): Promise<void> {
  try {
    const adminIds = await getActiveAdminIds();
    if (adminIds.length === 0) {
      return;
    }

    const title = "New order placed";
    const namePart = order.customer_name?.trim() || order.customer_email?.trim() || "Customer";
    const message = `${order.order_number} · ${formatMoney(order.total_amount, order.currency)} · ${namePart}`;

    const meta: NotificationMeta = {
      lifecycle_event: "order_placed",
      order_id: order.id,
      order_number: order.order_number,
      order_status: order.status,
      customer_name: order.customer_name?.trim() || undefined,
      customer_email: order.customer_email?.trim() || undefined,
    };

    void adminIds; // presence check only — insert as broadcast
    const rows: NotificationInsertRow[] = [{
      user_id: null,
      title,
      message,
      type: "order_status",
      read: false,
      meta,
    }];

    await insertNotificationRows(rows);
  } catch (error) {
    console.error("notifyAdminsOrderPlaced failed:", error);
  }
}

/**
 * Notify all active admins when an order status changes (best-effort).
 */
export async function notifyAdminsOrderStatusChanged(
  order: {
    id: string;
    order_number: string;
    status: OrderStatus;
    customer_name?: string | null;
    customer_email?: string | null;
    awb?: string | null;
  },
  previousStatus: OrderStatus
): Promise<void> {
  if (previousStatus === order.status) {
    return;
  }

  try {
    const adminIds = await getActiveAdminIds();
    if (adminIds.length === 0) {
      return;
    }

    const namePart = order.customer_name?.trim() || order.customer_email?.trim() || null;
    const title = `Order ${order.order_number} updated`;
    const message = `${namePart ? `${namePart} · ` : ""}Status changed to ${orderStatusLabel(order.status)} (was ${orderStatusLabel(previousStatus)}).`;

    const meta: NotificationMeta = {
      lifecycle_event: "order_status_changed",
      order_id: order.id,
      order_number: order.order_number,
      order_status: order.status,
      previous_order_status: previousStatus,
      customer_name: order.customer_name?.trim() || undefined,
      customer_email: order.customer_email?.trim() || undefined,
      awb: order.awb?.trim() || undefined,
    };

    void adminIds;
    const rows: NotificationInsertRow[] = [{
      user_id: null,
      title,
      message,
      type: "order_status",
      read: false,
      meta,
    }];

    await insertNotificationRows(rows);
  } catch (error) {
    console.error("notifyAdminsOrderStatusChanged failed:", error);
  }
}

/**
 * Notify all active admins when a payment status changes (best-effort).
 */
export async function notifyAdminsPaymentStatusChanged(
  order: {
    id: string;
    order_number: string;
    customer_name?: string | null;
    customer_email?: string | null;
  },
  payment: { id: string; status: PaymentStatus },
  previousStatus: PaymentStatus
): Promise<void> {
  if (previousStatus === payment.status) {
    return;
  }

  try {
    const adminIds = await getActiveAdminIds();
    if (adminIds.length === 0) {
      return;
    }

    const namePart = order.customer_name?.trim() || order.customer_email?.trim() || null;
    const title = `Payment update · ${order.order_number}`;
    const message = `${namePart ? `${namePart} · ` : ""}Payment ${paymentStatusLabel(payment.status)} (was ${paymentStatusLabel(previousStatus)}).`;

    const meta: NotificationMeta = {
      lifecycle_event: "payment_status_changed",
      order_id: order.id,
      order_number: order.order_number,
      customer_name: order.customer_name?.trim() || undefined,
      customer_email: order.customer_email?.trim() || undefined,
      payment_id: payment.id,
      payment_status: payment.status,
      previous_payment_status: previousStatus,
    };

    void adminIds;
    const rows: NotificationInsertRow[] = [{
      user_id: null,
      title,
      message,
      type: "payment_status",
      read: false,
      meta,
    }];

    await insertNotificationRows(rows);
  } catch (error) {
    console.error("notifyAdminsPaymentStatusChanged failed:", error);
  }
}

function formatScanDateTime(raw: string): string {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    return raw;
  }
  return d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: false });
}
