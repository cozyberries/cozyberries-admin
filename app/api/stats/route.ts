import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { authenticateRequest } from "@/lib/jwt-auth";

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

    const supabase = await createServerSupabaseClient();

    // Get user statistics using the admin function
    const { data: userStats, error: userStatsError } = await supabase.rpc(
      "get_user_statistics"
    );

    if (userStatsError) {
      console.error("Error fetching user statistics:", userStatsError);
      return NextResponse.json(
        { error: "Failed to fetch user statistics: " + userStatsError.message },
        { status: 500 }
      );
    }

    // Get order statistics
    const { data: orderStats, error: orderStatsError } = await supabase
      .from("orders")
      .select("status, total_amount, created_at")
      .gte(
        "created_at",
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      ); // Last 30 days

    if (orderStatsError) {
      console.error("Error fetching order statistics:", orderStatsError);
      return NextResponse.json(
        { error: "Failed to fetch order statistics" },
        { status: 500 }
      );
    }

    // Calculate order statistics
    const orderStatsCalculated = {
      total_orders: orderStats?.length || 0,
      orders_last_7_days:
        orderStats?.filter(
          (order) =>
            new Date(order.created_at) >=
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        ).length || 0,
      pending_orders:
        orderStats?.filter((order) => order.status === "payment_pending")
          .length || 0,
      completed_orders:
        orderStats?.filter((order) => order.status === "delivered").length || 0,
      total_revenue:
        orderStats?.reduce(
          (sum, order) => sum + (order.total_amount || 0),
          0
        ) || 0,
      average_order_value: orderStats?.length
        ? orderStats.reduce(
            (sum, order) => sum + (order.total_amount || 0),
            0
          ) / orderStats.length
        : 0,
    };

    // Get payment statistics
    const { data: paymentStats, error: paymentStatsError } = await supabase
      .from("payments")
      .select("status, amount, created_at")
      .gte(
        "created_at",
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      );

    const paymentStatsCalculated = {
      total_payments: paymentStats?.length || 0,
      successful_payments:
        paymentStats?.filter((payment) => payment.status === "completed")
          .length || 0,
      failed_payments:
        paymentStats?.filter((payment) => payment.status === "failed").length ||
        0,
      pending_payments:
        paymentStats?.filter((payment) => payment.status === "pending")
          .length || 0,
      total_payment_volume:
        paymentStats
          ?.filter((payment) => payment.status === "completed")
          .reduce((sum, payment) => sum + (payment.amount || 0), 0) || 0,
    };

    return NextResponse.json({
      users: userStats?.[0] || {
        total_users: 0,
        confirmed_users: 0,
        unconfirmed_users: 0,
        admin_users: 0,
        users_last_30_days: 0,
        users_last_7_days: 0,
      },
      orders: orderStatsCalculated,
      payments: paymentStatsCalculated,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching admin statistics:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
