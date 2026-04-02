import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-server";
import { authenticateRequest } from "@/lib/jwt-auth";
import {
  notifyAdminsOrderPlaced,
} from "@/lib/services/notification-service";
import type { OrderCreate, OrderStatus } from "@/lib/types/order";

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);

    if (!auth.isAuthenticated || !auth.isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const supabase = createAdminSupabaseClient();
    const body = await request.json();

    // Validate required fields
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "Items are required" }, { status: 400 });
    }
    if (!body.customer_email) {
      return NextResponse.json({ error: "Customer email is required" }, { status: 400 });
    }
    if (!body.shipping_address) {
      return NextResponse.json({ error: "Shipping address is required" }, { status: 400 });
    }
    if (!body.user_id || typeof body.user_id !== "string" || body.user_id.trim() === "") {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Verify user exists
    const { data: user, error: userError } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("id", body.user_id)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: "Invalid user ID: user does not exist" }, { status: 400 });
    }

    // Prepare order data (excluding items — stored in order_items table)
    const orderData: Omit<OrderCreate, "items"> & { status?: OrderStatus } = {
      user_id: body.user_id,
      customer_email: body.customer_email,
      customer_phone: body.customer_phone,
      shipping_address: body.shipping_address,
      billing_address: body.billing_address,
      subtotal: body.subtotal,
      delivery_charge: body.delivery_charge || 0,
      tax_amount: body.tax_amount || 0,
      total_amount: body.total_amount,
      currency: body.currency || "INR",
      notes: body.notes,
      status: body.status || "payment_pending",
    };

    // Create the order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert(orderData)
      .select()
      .single();

    if (orderError) {
      console.error("Error creating order:", orderError);
      return NextResponse.json(
        { error: `Failed to create order: ${orderError.message}` },
        { status: 500 }
      );
    }

    // Insert items into order_items table
    const orderItemsData = body.items.map((item: {
      id?: string;
      name: string;
      price: number;
      quantity: number;
      image?: string;
      product_details?: Record<string, unknown>;
    }) => ({
      order_id: order.id,
      product_id: item.id || null,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      image: item.image || null,
      product_details: item.product_details || null,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItemsData);

    if (itemsError) {
      console.error("Error inserting order items:", itemsError);
      // Rollback: delete the created order so we don't leave an empty shell
      try {
        await supabase.from("orders").delete().eq("id", order.id);
      } catch (rollbackErr) {
        console.error("Failed to rollback order after items insert error:", {
          orderId: order.id,
          originalError: itemsError.message,
          rollbackErr,
        });
      }
      return NextResponse.json(
        { error: `Failed to save order items: ${itemsError.message}` },
        { status: 500 }
      );
    }

    void notifyAdminsOrderPlaced({
      id: order.id,
      order_number: order.order_number,
      status: order.status as OrderStatus,
      total_amount: order.total_amount,
      currency: order.currency,
      customer_email: order.customer_email,
      customer_name:
        typeof order.shipping_address === "object" &&
        order.shipping_address !== null
          ? (order.shipping_address as Record<string, unknown>).full_name as string | null
          : null,
    });

    return NextResponse.json({ order: { ...order, items: body.items } }, { status: 201 });
  } catch (error) {
    console.error("Error creating order:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);

    if (!auth.isAuthenticated || !auth.isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const supabase = createAdminSupabaseClient();

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const status = searchParams.get("status");
    const fromDate = searchParams.get("from_date");
    const toDate = searchParams.get("to_date");

    // Helper to get end-of-day ISO string for toDate filter
    let toDateEndOfDay: string | null = null;
    if (toDate) {
      const d = new Date(toDate);
      if (!Number.isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        toDateEndOfDay = d.toISOString();
      }
    }

    // Count query with identical filters (no pagination)
    let countQuery = supabase.from("orders").select("*", { count: "exact", head: true });
    if (status && status !== "all") countQuery = countQuery.eq("status", status);
    if (fromDate) countQuery = countQuery.gte("created_at", fromDate);
    if (toDateEndOfDay) countQuery = countQuery.lte("created_at", toDateEndOfDay);
    const { count: totalCount, error: countError } = await countQuery;
    if (countError) {
      console.error("Count query error:", countError);
      return NextResponse.json(
        { error: "Failed to count orders: " + countError.message },
        { status: 500 }
      );
    }

    // Paginated data query
    let query = supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (status && status !== "all") query = query.eq("status", status);
    if (fromDate) query = query.gte("created_at", fromDate);
    if (toDateEndOfDay) query = query.lte("created_at", toDateEndOfDay);

    const { data: orders, error: ordersError } = await query;

    if (ordersError) {
      console.error("Database query error:", ordersError);
      return NextResponse.json(
        { error: "Failed to fetch orders: " + ordersError.message },
        { status: 500 }
      );
    }

    const orderIds = orders?.map((o) => o.id) || [];

    // Batch-fetch order_items
    const itemsMap: Record<string, unknown[]> = {};
    if (orderIds.length > 0) {
      const { data: orderItems, error: itemsError } = await supabase
        .from("order_items")
        .select("*")
        .in("order_id", orderIds);

      if (itemsError) {
        console.error("Error fetching order items:", itemsError);
      } else if (orderItems) {
        orderItems.forEach((item) => {
          if (!itemsMap[item.order_id]) itemsMap[item.order_id] = [];
          itemsMap[item.order_id].push(item);
        });
      }
    }

    // Batch-fetch payments
    const paymentsMap: Record<string, unknown[]> = {};
    if (orderIds.length > 0) {
      const { data: payments, error: paymentsError } = await supabase
        .from("payments")
        .select("*")
        .in("order_id", orderIds)
        .order("created_at", { ascending: false });

      if (!paymentsError && payments) {
        payments.forEach((payment) => {
          if (!paymentsMap[payment.order_id]) paymentsMap[payment.order_id] = [];
          paymentsMap[payment.order_id].push(payment);
        });
      }
    }

    const ordersWithData = orders?.map((order) => ({
      ...order,
      items: itemsMap[order.id] || [],
      payments: paymentsMap[order.id] || [],
    })) || [];

    return NextResponse.json({ orders: ordersWithData, total: totalCount ?? ordersWithData.length });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}
