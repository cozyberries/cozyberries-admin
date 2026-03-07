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
    const { data: rawItems } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId);

    const orderItems = rawItems || [];

    // Enrich size/color from product variants when product_details is missing
    const productIdsToEnrich = [
      ...new Set(
        orderItems
          .filter(
            (item: { product_id?: string | null; product_details?: { size?: string; color?: string } | null }) =>
              item.product_id && (!item.product_details?.size || !item.product_details?.color)
          )
          .map((item: { product_id: string }) => item.product_id)
      ),
    ] as string[];

    let variantsByProductId: Record<string, { size_slug: string; color_slug: string }> = {};
    if (productIdsToEnrich.length > 0) {
      const { data: products } = await supabase
        .from("products")
        .select("id, slug")
        .in("id", productIdsToEnrich);
      const slugs = (products || []).map((p: { slug: string }) => p.slug);
      if (slugs.length > 0) {
        const { data: variants } = await supabase
          .from("product_variants")
          .select("product_slug, size_slug, color_slug")
          .in("product_slug", slugs);
        const slugById: Record<string, string> = {};
        (products || []).forEach((p: { id: string; slug: string }) => {
          slugById[p.id] = p.slug;
        });
        const variantsBySlug: Record<string, { size_slug: string; color_slug: string }[]> = {};
        (variants || []).forEach((v: { product_slug: string; size_slug: string; color_slug: string }) => {
          if (!variantsBySlug[v.product_slug]) variantsBySlug[v.product_slug] = [];
          variantsBySlug[v.product_slug].push({ size_slug: v.size_slug, color_slug: v.color_slug });
        });
        Object.keys(slugById).forEach((id) => {
          const list = variantsBySlug[slugById[id]];
          if (list?.length === 1) {
            variantsByProductId[id] = list[0];
          }
        });
      }
    }

    const items = orderItems.map((item: { product_id?: string | null; product_details?: Record<string, unknown> | null; [key: string]: unknown }) => {
      const enriched = variantsByProductId[item.product_id as string];
      if (!enriched) return item;
      const existing = item.product_details && typeof item.product_details === "object" ? item.product_details : {};
      const existingSize = existing.size ?? existing.size_slug;
      const existingColor = existing.color ?? existing.color_slug;
      return {
        ...item,
        product_details: {
          ...existing,
          size: (existingSize as string) || enriched.size_slug,
          color: (existingColor as string) || enriched.color_slug,
        },
      };
    });

    // Fetch associated payments
    const { data: payments } = await supabase
      .from("payments")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false });

    return NextResponse.json({ ...order, items, payments: payments || [] });
  } catch (err) {
    console.error("GET /api/orders/[id] error:", err);
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
  } catch (err) {
    console.error("PUT /api/orders/[id] error:", err);
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

    // Delete child records first
    // TODO: Consider implementing database-level ON DELETE CASCADE constraints
    // for checkout_sessions, order_items, and payments tables to ensure atomic
    // deletion without risk of orphaned records if an intermediate step fails.
    // Current sequential deletes provide order but not transactional guarantees.
    const { error: checkoutError } = await supabase
      .from("checkout_sessions")
      .delete()
      .eq("order_id", orderId);

    if (checkoutError) {
      console.error("DELETE checkout_sessions error:", checkoutError);
      return NextResponse.json(
        { error: `Failed to delete checkout sessions: ${checkoutError.message}` },
        { status: 500 }
      );
    }

    const { error: itemsError } = await supabase
      .from("order_items")
      .delete()
      .eq("order_id", orderId);

    if (itemsError) {
      console.error("DELETE order_items error:", itemsError);
      return NextResponse.json(
        { error: `Failed to delete order items: ${itemsError.message}` },
        { status: 500 }
      );
    }

    const { error: paymentsError } = await supabase
      .from("payments")
      .delete()
      .eq("order_id", orderId);

    if (paymentsError) {
      console.error("DELETE payments error:", paymentsError);
      return NextResponse.json(
        { error: `Failed to delete payments: ${paymentsError.message}` },
        { status: 500 }
      );
    }

    const { error: deleteError } = await supabase
      .from("orders")
      .delete()
      .eq("id", orderId);

    if (deleteError) {
      console.error("DELETE orders error:", deleteError);
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
  } catch (err) {
    console.error("DELETE /api/orders/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
