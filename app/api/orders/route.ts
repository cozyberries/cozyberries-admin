import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-server";
import { authenticateRequest } from "@/lib/jwt-auth";
import type { OrderCreate, OrderStatus } from "@/lib/types/order";

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request using JWT
    const auth = await authenticateRequest(request);

    if (!auth.isAuthenticated || !auth.isAdmin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const supabase = createAdminSupabaseClient();
    const body = await request.json();

    // Validate required fields
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: "Items are required" },
        { status: 400 }
      );
    }

    if (!body.customer_email) {
      return NextResponse.json(
        { error: "Customer email is required" },
        { status: 400 }
      );
    }

    if (!body.shipping_address) {
      return NextResponse.json(
        { error: "Shipping address is required" },
        { status: 400 }
      );
    }

    if (!body.user_id || typeof body.user_id !== "string" || body.user_id.trim() === "") {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Verify that the user exists in the database
    const { data: user, error: userError } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("id", body.user_id)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Invalid user ID: user does not exist" },
        { status: 400 }
      );
    }

    // Prepare order data
    const orderData: OrderCreate & { status?: OrderStatus; order_number?: string } = {
      user_id: body.user_id,
      customer_email: body.customer_email,
      customer_phone: body.customer_phone,
      shipping_address: body.shipping_address,
      billing_address: body.billing_address,
      items: body.items,
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

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    console.error("Error creating order:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate the request using JWT
    const auth = await authenticateRequest(request);

    if (!auth.isAuthenticated || !auth.isAdmin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const supabase = createAdminSupabaseClient();

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const status = searchParams.get("status");
    const fromDate = searchParams.get("from_date");
    const toDate = searchParams.get("to_date");

    let query = supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    // Apply date filters
    if (fromDate) {
      query = query.gte("created_at", fromDate);
    }
    if (toDate) {
      // Add end of day to toDate to include the entire day
      const endOfDay = new Date(toDate);
      endOfDay.setHours(23, 59, 59, 999);
      query = query.lte("created_at", endOfDay.toISOString());
    }

    const { data: orders, error: ordersError } = await query;

    if (ordersError) {
      console.error("Database query error:", ordersError);
      return NextResponse.json(
        { error: "Failed to fetch orders: " + ordersError.message },
        { status: 500 }
      );
    }

    // Fetch payments for all orders
    const orderIds = orders?.map((order) => order.id) || [];
    let paymentsMap: Record<string, any[]> = {};
    
    if (orderIds.length > 0) {
      const { data: payments, error: paymentsError } = await supabase
        .from("payments")
        .select("*")
        .in("order_id", orderIds)
        .order("created_at", { ascending: false });

      if (!paymentsError && payments) {
        // Group payments by order_id
        payments.forEach((payment) => {
          if (!paymentsMap[payment.order_id]) {
            paymentsMap[payment.order_id] = [];
          }
          paymentsMap[payment.order_id].push(payment);
        });
      }
    }

    // Attach payments to orders
    const ordersWithPayments = orders?.map((order) => ({
      ...order,
      payments: paymentsMap[order.id] || [],
    })) || [];

    console.log(`Fetched ${orders?.length || 0} orders from database`);

    return NextResponse.json({
      orders: ordersWithPayments,
      total: orders?.length || 0,
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
