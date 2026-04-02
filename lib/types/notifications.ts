export interface WebhookEvent {
  id: string;
  source: string;
  event_type: string;
  awb: string | null;
  // Delhivery payload is strongly typed; other providers remain open-ended.
  payload: DelhiveryWebhookPayload | Record<string, unknown>;
  status: 'pending' | 'processing' | 'processed' | 'failed';
  attempt_count: number;
  next_retry_at: string | null;
  last_error: string | null;
  received_at: string;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'shipping_scan' | 'order_status' | 'payment_status';
  read: boolean;
  meta: NotificationMeta | null;
  created_at: string;
  updated_at: string;
}

export type OrderLifecycleEvent =
  | "order_placed"
  | "order_status_changed"
  | "payment_status_changed";

export interface NotificationMeta {
  order_id?: string;
  order_number?: string;
  /** Customer display name (from shipping_address.full_name) */
  customer_name?: string;
  /** Customer contact email */
  customer_email?: string;
  awb?: string;
  scan_status?: string;
  scan_location?: string;
  scan_time?: string;
  /** Set for order/payment lifecycle rows (not shipping_scan). */
  lifecycle_event?: OrderLifecycleEvent;
  order_status?: string;
  previous_order_status?: string;
  payment_id?: string;
  payment_status?: string;
  previous_payment_status?: string;
}

// Delhivery webhook payload shape (v1 contract - token header auth)
export interface DelhiveryWebhookScan {
  AWB: string;
  Status: string; // e.g. "Manifested", "In Transit", "Delivered"
  StatusType?: string; // e.g. "UD", "IT", "DL"
  StatusDateTime: string; // ISO or Delhivery datetime string
  StatusLocation?: string;
  Instructions?: string;
  PickUpDate?: string;
  ReferenceNo?: string;
}

export type DelhiveryWebhookPayload =
  | {
      // Batch format: payload wraps scans under `scans`.
      scans: DelhiveryWebhookScan[];
    }
  | ({
      // Flat single-scan format: required core fields.
      AWB: string;
      Status: string;
      StatusDateTime: string;
    } & Pick<
      DelhiveryWebhookScan,
      'StatusType' | 'StatusLocation' | 'Instructions' | 'PickUpDate' | 'ReferenceNo'
    >);

export interface WebhookMetrics {
  pending_count: number;
  processing_count: number;
  failed_count: number;
  oldest_pending_age_seconds: number | null;
  last_processed_at: string | null;
  recent_failures: Array<{
    id: string;
    attempt_count: number;
    last_error: string | null;
    updated_at: string;
  }>;
}
