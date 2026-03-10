import config from "./config";
import type {
  CreateShipmentRequest,
  CreateShipmentResponse,
  EditShipmentRequest,
  EditShipmentResponse,
  CancelShipmentResponse,
  PackingSlipResponse,
  PackingSlipRawResponse,
  DelhiveryResult,
} from "./types";

function headers(): HeadersInit {
  return {
    Authorization: `Token ${config.token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function maskedToken(): string {
  return config.token ? config.token.slice(0, 8) + "***" : "(empty)";
}

async function request<T>(
  method: "GET" | "POST" | "PUT",
  path: string,
  opts?: { body?: string; contentType?: string; params?: Record<string, string> }
): Promise<DelhiveryResult<T>> {
  const url = new URL(path, config.baseUrl);
  if (opts?.params) {
    for (const [k, v] of Object.entries(opts.params)) {
      url.searchParams.set(k, v);
    }
  }

  const hdrs: Record<string, string> = {
    Authorization: `Token ${config.token}`,
    Accept: "application/json",
  };
  if (opts?.contentType) {
    hdrs["Content-Type"] = opts.contentType;
  } else if (method !== "GET") {
    hdrs["Content-Type"] = "application/json";
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeout);

    const res = await fetch(url.toString(), {
      method,
      headers: hdrs,
      body: opts?.body,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.status === 401) {
      const text = await res.text().catch(() => "");
      console.error("[delhivery] 401 Unauthorized", { token: maskedToken(), response: text });
      return { ok: false, error: text || "Authentication failed", statusCode: 401 };
    }

    if (res.status === 400) {
      const text = await res.text().catch(() => "");
      console.error("[delhivery] 400 Bad Request", { path, response: text });
      return { ok: false, error: text || "Bad request", statusCode: 400 };
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[delhivery] HTTP ${res.status}`, { path, response: text });
      return { ok: false, error: text || `HTTP ${res.status}`, statusCode: res.status };
    }

    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (err: unknown) {
    const isAbort = (e: unknown) =>
      (e instanceof DOMException && e.name === "AbortError") ||
      (e && typeof e === "object" && "name" in e && (e as Error).name === "AbortError");
    if (isAbort(err)) {
      console.error("[delhivery] Request timed out", { path, timeout: config.timeout });
      return { ok: false, error: "Request timed out" };
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[delhivery] Network error", { path, error: msg });
    return { ok: false, error: msg };
  }
}

// ── Public API ────────────────────────────────────────────────────────────

export async function createShipment(
  payload: CreateShipmentRequest
): Promise<DelhiveryResult<CreateShipmentResponse>> {
  const body = `format=json&data=${encodeURIComponent(JSON.stringify(payload))}`;
  return request<CreateShipmentResponse>("POST", "/api/cmu/create.json", {
    body,
    contentType: "application/x-www-form-urlencoded",
  });
}

export async function editShipment(
  payload: EditShipmentRequest
): Promise<DelhiveryResult<EditShipmentResponse>> {
  return request<EditShipmentResponse>("POST", "/api/p/edit", {
    body: JSON.stringify(payload),
  });
}

export async function cancelShipment(
  waybill: string
): Promise<DelhiveryResult<CancelShipmentResponse>> {
  return request<CancelShipmentResponse>("POST", "/api/p/edit", {
    body: JSON.stringify({ waybill, cancellation: "true" }),
  });
}

export async function getPackingSlip(
  waybill: string,
  pdfSize: "A4" | "4R" = "A4"
): Promise<DelhiveryResult<PackingSlipResponse>> {
  return request<PackingSlipResponse>("GET", "/api/p/packing_slip", {
    params: { wbns: waybill, pdf: "true", pdf_size: pdfSize },
  });
}

/** Fetch raw JSON label data (pdf=false) — contains base64 barcodes, logos, product list */
export async function getPackingSlipJSON(
  waybill: string
): Promise<DelhiveryResult<PackingSlipRawResponse>> {
  return request<PackingSlipRawResponse>("GET", "/api/p/packing_slip", {
    params: { wbns: waybill, pdf: "false" },
  });
}
