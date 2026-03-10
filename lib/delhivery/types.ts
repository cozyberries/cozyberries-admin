// ── Shipment Creation ─────────────────────────────────────────────────────

export interface DelhiveryShipment {
  name: string;
  order: string;
  phone: string;
  add: string;
  pin: number;
  payment_mode: "Prepaid" | "COD" | "Pickup" | "REPL";
  address_type?: string;
  ewbn?: string;
  hsn_code?: string;
  shipping_mode?: "Surface" | "Express";
  seller_inv?: string;
  city?: string;
  weight: number;
  return_name?: string;
  return_address?: string;
  return_city?: string;
  return_phone?: string;
  return_state?: string;
  return_country?: string;
  return_pin?: number | null;
  seller_name?: string;
  fragile_shipment?: boolean;
  shipment_height?: number;
  shipment_width?: number;
  shipment_length?: number;
  cod_amount?: number;
  products_desc?: string;
  state?: string;
  dangerous_good?: boolean;
  waybill?: string;
  total_amount?: number;
  seller_add?: string;
  country?: string;
  plastic_packaging?: boolean;
  quantity?: string;
  transport_speed?: "F" | "D";
  order_date?: string | null;
  shipment_type?: "MPS";
  mps_amount?: number;
  mps_children?: number;
  master_id?: string;
}

export interface CreateShipmentRequest {
  shipments: DelhiveryShipment[];
  pickup_location: {
    name: string;
  };
}

export interface PackageResponse {
  status: string;
  client: string;
  sort_code: string | null;
  remarks: string[];
  waybill: string;
  cod_amount: number;
  payment: string;
  serviceable: boolean;
  refnum: string;
}

export interface CreateShipmentResponse {
  cash_pickups_count: number;
  package_count: number;
  upload_wbn: string | null;
  replacement_count: number;
  pickups_count: number;
  packages: PackageResponse[];
  cash_pickups: number;
  cod_count: number;
  success: boolean;
  prepaid_count: number;
  cod_amount: number;
  rmk?: string;
  error?: boolean;
}

// ── Edit Shipment ─────────────────────────────────────────────────────────

export interface EditShipmentRequest {
  waybill: string;
  name?: string;
  phone?: string;
  pt?: string;
  add?: string;
  products_desc?: string;
  gm?: number;
  shipment_height?: number;
  shipment_width?: number;
  shipment_length?: number;
  cod?: number;
}

export interface EditShipmentResponse {
  status: boolean | string;
  waybill: string | null;
  order_id: string | null;
  error?: string;
}

// ── Cancel Shipment ───────────────────────────────────────────────────────

export interface CancelShipmentRequest {
  waybill: string;
  cancellation: "true";
}

export interface CancelShipmentResponse {
  status: boolean;
  waybill: string | null;
  remark: string | null;
  order_id: string | null;
  error?: string;
}

// ── Packing Slip (PDF link mode) ─────────────────────────────────────────

export interface PackingSlipPackage {
  wbn: string;
  pdf_download_link?: string;
  pdf_encoding?: string;
}

export interface PackingSlipResponse {
  packages: PackingSlipPackage[];
  packages_found: number;
}

// ── Packing Slip (JSON / raw label data mode, pdf=false) ─────────────────

export interface PackingSlipRawPackage {
  wbn: string;
  oid: string;
  cd: string;
  barcode: string;           // base64 PNG data URI of waybill barcode
  oid_barcode: string;       // base64 PNG data URI of order ID barcode
  delhivery_logo: string;    // URL to Delhivery logo
  cl_logo: string;           // signed S3 URL to client logo (1h expiry)
  cl: string;                // client code
  sort_code: string;
  name: string;              // consignee name
  address: string;
  pin: number;
  contact: string;
  destination: string;
  destination_city: string;
  st: string;                // customer state
  origin: string;
  origin_city: string;
  origin_state: string;
  snm: string;               // seller name
  sadd: string;              // seller address
  radd: string;              // return address
  pt: string;                // payment type ("Pre-paid" | "COD")
  cod: number;
  rs: number;                // invoice/total amount
  weight: number;
  qty: string;
  prd: string;               // tilde-separated "ProductName(qty)~ProductName(qty)"
  pdd: string;               // promised delivery date
  mot: string;               // mode of transport ("S"=Surface)
  ewbn: string[];
  shipment_width?: number;
  shipment_length?: number;
  shipment_height?: number;
}

export interface PackingSlipRawResponse {
  packages: PackingSlipRawPackage[];
  packages_found: number;
}

// ── Generic result wrapper ────────────────────────────────────────────────

export type DelhiveryResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; statusCode?: number };
