import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-server";
import { authenticateRequest } from "@/lib/jwt-auth";
import CacheService from "@/lib/services/cache";
import type { OrderStatus } from "@/lib/types/order";

const VALID_STATUSES: OrderStatus[] = [
  "payment_pending",
  "payment_confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
];

export async function GET(
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

    const { data: order, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Fetch order items
    const { data: orderItems } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId);

    // Fetch associated payments
    const { data: payments } = await supabase
      .from("payments")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false });

    return NextResponse.json({ ...order, items: orderItems || [], payments: payments || [] });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.isAuthenticated || !auth.isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const supabase = createAdminSupabaseClient();
    const body = await request.json();
    const { id: orderId } = await params;

    // Build update payload — only include provided fields
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: "Invalid order status" }, { status: 400 });
      }
      updateData.status = body.status;
    }

    if (body.tracking_number !== undefined) {
      updateData.tracking_number = body.tracking_number;
    }

    if (body.carrier_name !== undefined) {
      updateData.carrier_name = body.carrier_name;
    }

    if (body.estimated_delivery_date !== undefined) {
      updateData.estimated_delivery_date = body.estimated_delivery_date;
    }

    if (body.actual_delivery_date !== undefined) {
      updateData.actual_delivery_date = body.actual_delivery_date;
    }

    if (body.delivery_notes !== undefined) {
      updateData.delivery_notes = body.delivery_notes;
    }

    if (body.notes !== undefined) {
      updateData.notes = body.notes;
    }

    const { data, error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", orderId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: `Failed to update order: ${error.message}` },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Clear cache
    try {
      await CacheService.clearAllOrders(data.user_id);
      await CacheService.clearOrderDetails(data.user_id, orderId);
    } catch (cacheError) {
      console.error("Error clearing orders cache after admin update:", cacheError);
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
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

    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("user_id")
      .eq("id", orderId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const { error: deleteError } = await supabase
      .from("orders")
      .delete()
      .eq("id", orderId);

    if (deleteError) {
      return NextResponse.json(
        { error: `Failed to delete order: ${deleteError.message}` },
        { status: 500 }
      );
    }

    try {
      await CacheService.clearAllOrders(order.user_id);
      await CacheService.clearOrderDetails(order.user_id, orderId);
    } catch (cacheError) {
      console.error("Error clearing cache after delete:", cacheError);
    }

    return NextResponse.json({ success: true, message: "Order deleted successfully" });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
