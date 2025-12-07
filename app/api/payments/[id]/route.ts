import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-server";
import { authenticateRequest } from "@/lib/jwt-auth";
import type { PaymentStatus } from "@/lib/types/order";
import CacheService from "@/lib/services/cache";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
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
    const resolvedParams = await params;
    const { id } = resolvedParams;
    const body = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "Payment ID is required" },
        { status: 400 }
      );
    }

    // Get the current payment
    const { data: currentPayment, error: fetchError } = await supabase
      .from("payments")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !currentPayment) {
      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    // Admin can update payment status without transition validation
    if (body.status) {
      const validStatuses: PaymentStatus[] = [
        'pending',
        'processing',
        'completed',
        'failed',
        'cancelled',
        'refunded',
        'partially_refunded',
      ];
      
      if (validStatuses.includes(body.status)) {
        updateData.status = body.status;
        
        // Update timestamps based on status
        if (body.status === 'completed' && currentPayment.status !== 'completed') {
          updateData.completed_at = new Date().toISOString();
        } else if (body.status === 'failed' && currentPayment.status !== 'failed') {
          updateData.failed_at = new Date().toISOString();
        }
      } else {
        return NextResponse.json(
          { error: "Invalid payment status" },
          { status: 400 }
        );
      }
    }

    // Admin can update other payment fields
    if (body.gateway_response !== undefined) {
      updateData.gateway_response = body.gateway_response;
    }

    if (body.failure_reason !== undefined) {
      updateData.failure_reason = body.failure_reason;
    }

    if (body.card_last_four !== undefined) {
      updateData.card_last_four = body.card_last_four;
    }

    if (body.card_brand !== undefined) {
      updateData.card_brand = body.card_brand;
    }

    if (body.card_type !== undefined) {
      updateData.card_type = body.card_type;
    }

    if (body.upi_id !== undefined) {
      updateData.upi_id = body.upi_id;
    }

    if (body.bank_name !== undefined) {
      updateData.bank_name = body.bank_name;
    }

    if (body.bank_reference !== undefined) {
      updateData.bank_reference = body.bank_reference;
    }

    if (body.notes !== undefined) {
      updateData.notes = body.notes;
    }

    if (body.refunded_amount !== undefined) {
      updateData.refunded_amount = body.refunded_amount;
    }

    if (body.refund_reference !== undefined) {
      updateData.refund_reference = body.refund_reference;
    }

    if (body.refund_reason !== undefined) {
      updateData.refund_reason = body.refund_reason;
    }

    if (Object.keys(updateData).length === 1) {
      // Only updated_at was set
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Update the payment (admin can update any payment)
    const { data: payment, error: updateError } = await supabase
      .from("payments")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError || !payment) {
      console.error("Error updating payment:", updateError);
      return NextResponse.json(
        { error: `Failed to update payment: ${updateError?.message || 'Unknown error'}` },
        { status: 500 }
      );
    }

    try {
      await CacheService.clearAllOrders(currentPayment.user_id);
      await CacheService.clearOrderDetails(currentPayment.user_id, currentPayment.order_id);
      console.log(`Orders cache cleared for user: ${currentPayment.user_id} after admin update`);
    } catch (cacheError) {
      console.error("Error clearing orders cache after admin update:", cacheError);
    }
    return NextResponse.json({ payment });
  } catch (error) {
    console.error("Error updating payment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
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
    const resolvedParams = await params;
    const { id } = resolvedParams;

    if (!id) {
      return NextResponse.json(
        { error: "Payment ID is required" },
        { status: 400 }
      );
    }

    // Get the payment (admin can view any payment)
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("*")
      .eq("id", id)
      .single();

    if (paymentError || !payment) {
      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ payment });
  } catch (error) {
    console.error("Error fetching payment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

