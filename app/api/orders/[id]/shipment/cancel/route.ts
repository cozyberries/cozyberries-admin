import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-server";
import { authenticateRequest } from "@/lib/jwt-auth";
import CacheService from "@/lib/services/cache";
import { cancelShipment } from "@/lib/delhivery/client";

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
      .select("tracking_number, carrier_name, user_id, status")
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

    const result = await cancelShipment(order.tracking_number);
    if (!result.ok) {
      return NextResponse.json(
        { error: `Delhivery API error: ${result.error}` },
        { status: result.statusCode || 502 }
      );
    }

    const resp = result.data;
    if (!resp.status) {
      return NextResponse.json(
        { error: resp.error || "Cancellation failed at Delhivery" },
        { status: 422 }
      );
    }

    const { error: updateErr } = await supabase
      .from("orders")
      .update({
        status: "cancelled",
        delivery_notes: resp.remark || "Shipment cancelled via Delhivery",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updateErr) {
      console.error("Failed to update order status after cancellation", updateErr);
      return NextResponse.json(
        {
          success: false,
          delhivery_success: true,
          db_update_success: false,
          error: updateErr.message,
          waybill: resp.waybill,
          remark: resp.remark,
          order_id: resp.order_id,
        },
        { status: 503 }
      );
    }

    try {
      await CacheService.clearAllOrders(order.user_id);
      await CacheService.clearOrderDetails(order.user_id, orderId);
    } catch (err) {
      console.error("Cache clear failed after shipment cancel", { orderId, userId: order.user_id, err });
    }

    return NextResponse.json({
      success: true,
      delhivery_success: true,
      db_update_success: true,
      waybill: resp.waybill,
      remark: resp.remark,
      order_id: resp.order_id,
    });
  } catch (err) {
    console.error("POST /api/orders/[id]/shipment/cancel error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
