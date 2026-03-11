import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-server";
import { authenticateRequest } from "@/lib/jwt-auth";
import CacheService from "@/lib/services/cache";
import { createShipment, editShipment } from "@/lib/delhivery/client";
import delhiveryConfig from "@/lib/delhivery/config";
import type { DelhiveryShipment, CreateShipmentRequest, EditShipmentRequest } from "@/lib/delhivery/types";

// ── POST — Create Delhivery shipment for an order ────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.isAuthenticated || !auth.isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const supabase = createAdminSupabaseClient();
    const { id: orderId } = await params;

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("order_number, tracking_number, carrier_name, shipping_address, customer_phone, total_amount, payments, user_id")
      .eq("id", orderId)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.tracking_number && order.carrier_name === "Delhivery") {
      return NextResponse.json(
        { error: "Delhivery shipment already exists", waybill: order.tracking_number },
        { status: 409 }
      );
    }

    const { data: items } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId);

    const body = await request.json().catch(() => ({}));
    const addr = order.shipping_address;
    if (!addr) {
      return NextResponse.json({ error: "Order has no shipping address" }, { status: 400 });
    }

    const warehouseName = (body.warehouse_name as string) || delhiveryConfig.warehouseName;
    if (!warehouseName) {
      return NextResponse.json(
        { error: "DELHIVERY_WAREHOUSE_NAME not configured and no warehouse_name in body" },
        { status: 400 }
      );
    }

    // Format: "Name(qty)~Name(qty)" — Delhivery stores this verbatim in prd field
    const productNames = (items || [])
      .map((i: { name: string; quantity: number }) => `${i.name}(${i.quantity || 1})`)
      .join("~");

    const totalQty = (items || []).reduce(
      (sum: number, i: { quantity: number }) => sum + (i.quantity || 1),
      0
    );

    const isCod = order.payments?.some?.(
      (p: { payment_method: string; status: string }) =>
        p.payment_method === "cod" && p.status === "completed"
    );
    const paymentMode = (body.payment_mode as string) || (isCod ? "COD" : "Prepaid");

    const shipment: DelhiveryShipment = {
      name: addr.full_name,
      order: order.order_number || orderId,
      phone: addr.phone || order.customer_phone || "",
      add: [addr.address_line_1, addr.address_line_2].filter(Boolean).join(", "),
      pin: parseInt(addr.postal_code, 10),
      city: addr.city,
      state: addr.state,
      country: addr.country || "India",
      payment_mode: paymentMode as DelhiveryShipment["payment_mode"],
      cod_amount: paymentMode === "COD" ? order.total_amount : 0,
      total_amount: order.total_amount,
      weight: (body.weight as number) || 500,
      products_desc: productNames || "Products",
      quantity: String(totalQty || 1),
      seller_name: delhiveryConfig.warehouseName || "Cozyberries",
      seller_add: body.seller_add || "",
      return_name: delhiveryConfig.warehouseName || "Cozyberries",
      shipping_mode: (body.shipping_mode as DelhiveryShipment["shipping_mode"]) || "Surface",
      waybill: "",
    };

    if (body.shipment_height) shipment.shipment_height = Number(body.shipment_height);
    if (body.shipment_width) shipment.shipment_width = Number(body.shipment_width);
    if (body.shipment_length) shipment.shipment_length = Number(body.shipment_length);

    const payload: CreateShipmentRequest = {
      shipments: [shipment],
      pickup_location: { name: warehouseName },
    };

    const result = await createShipment(payload);
    if (!result.ok) {
      return NextResponse.json(
        { error: `Delhivery API error: ${result.error}` },
        { status: result.statusCode || 502 }
      );
    }

    const resp = result.data;
    if (!resp.success) {
      return NextResponse.json(
        { error: resp.rmk || "Shipment creation failed at Delhivery" },
        { status: 422 }
      );
    }

    const pkg = resp.packages?.[0];
    if (!pkg || pkg.status !== "Success") {
      const remarks = pkg?.remarks?.join("; ") || "Unknown error";
      return NextResponse.json({ error: remarks }, { status: 422 });
    }

    const waybill = pkg.waybill;

    const { error: updateErr } = await supabase
      .from("orders")
      .update({
        tracking_number: waybill,
        carrier_name: "Delhivery",
        status: "processing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updateErr) {
      console.error("Failed to persist waybill on order", updateErr);
    }

    try {
      await CacheService.clearAllOrders(order.user_id);
      await CacheService.clearOrderDetails(order.user_id, orderId);
    } catch (err) {
      console.error("Cache clear failed after shipment create", { orderId, userId: order.user_id, err });
    }

    return NextResponse.json({
      success: true,
      waybill,
      package_count: resp.package_count,
      upload_wbn: resp.upload_wbn,
    });
  } catch (err) {
    console.error("POST /api/orders/[id]/shipment error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── PATCH — Update an existing Delhivery shipment ────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.isAuthenticated || !auth.isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const supabase = createAdminSupabaseClient();
    const { id: orderId } = await params;

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("tracking_number, carrier_name, user_id")
      .eq("id", orderId)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (!order.tracking_number || order.carrier_name !== "Delhivery") {
      return NextResponse.json(
        { error: "No Delhivery shipment found for this order" },
        { status: 400 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const payload: EditShipmentRequest = {
      waybill: order.tracking_number,
    };

    if (body.name != null && body.name !== "") payload.name = String(body.name);
    if (body.phone != null) payload.phone = String(body.phone);
    if (body.address != null && body.address !== "") payload.add = String(body.address);
    if (body.payment_type != null && body.payment_type !== "") payload.pt = String(body.payment_type);
    if (body.products_desc != null && body.products_desc !== "") payload.products_desc = String(body.products_desc);
    if (body.weight != null) payload.gm = Number(body.weight);
    if (body.shipment_height != null) payload.shipment_height = Number(body.shipment_height);
    if (body.shipment_width != null) payload.shipment_width = Number(body.shipment_width);
    if (body.shipment_length != null) payload.shipment_length = Number(body.shipment_length);
    if (body.cod_amount != null) payload.cod = Number(body.cod_amount);

    const result = await editShipment(payload);
    if (!result.ok) {
      return NextResponse.json(
        { error: `Delhivery API error: ${result.error}` },
        { status: result.statusCode || 502 }
      );
    }

    const resp = result.data;
    if (resp.status !== true) {
      return NextResponse.json(
        { error: resp.error || "Edit shipment failed at Delhivery" },
        { status: 422 }
      );
    }

    try {
      await CacheService.clearAllOrders(order.user_id);
      await CacheService.clearOrderDetails(order.user_id, orderId);
    } catch (err) {
      console.error("Cache clear failed after shipment edit", { orderId, userId: order.user_id, err });
    }

    return NextResponse.json({
      success: true,
      waybill: resp.waybill,
      order_id: resp.order_id,
    });
  } catch (err) {
    console.error("PATCH /api/orders/[id]/shipment error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
