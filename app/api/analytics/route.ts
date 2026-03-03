import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-server";
import { authenticateRequest } from "@/lib/jwt-auth";

// Revenue-counted statuses: money has been collected
const REVENUE_STATUSES = ["payment_confirmed", "processing", "shipped", "delivered"];

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);

    if (!auth.isAuthenticated || !auth.isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 401 });
    }

    const supabase = createAdminSupabaseClient();

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const startOfMonth = new Date(currentYear, currentMonth, 1).toISOString();

    // Six months ago for chart data
    const sixMonthsAgo = new Date(currentYear, currentMonth - 5, 1).toISOString();

    // Fetch all orders from the last 6 months in one query
    const { data: recentOrders } = await supabase
      .from("orders")
      .select("id, total_amount, status, created_at")
      .gte("created_at", sixMonthsAgo)
      .order("created_at", { ascending: false });

    // Fetch ALL orders for lifetime totals
    const { data: allOrders } = await supabase
      .from("orders")
      .select("id, total_amount, status, created_at");

    // Products count
    const { count: totalProducts } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true });

    // Users
    const { data: authUsersData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const allUsers = authUsersData?.users ?? [];

    // ── Lifetime stats ────────────────────────────────────────────────────────
    const totalOrders = allOrders?.length ?? 0;
    const totalRevenue =
      allOrders
        ?.filter((o) => REVENUE_STATUSES.includes(o.status))
        .reduce((sum, o) => sum + (o.total_amount ?? 0), 0) ?? 0;
    const totalUsers = allUsers.length;

    // ── This month stats ──────────────────────────────────────────────────────
    const thisMonthOrders = allOrders?.filter((o) => o.created_at >= startOfMonth) ?? [];
    const monthlyOrders = thisMonthOrders.length;
    const monthlyRevenue = thisMonthOrders
      .filter((o) => REVENUE_STATUSES.includes(o.status))
      .reduce((sum, o) => sum + (o.total_amount ?? 0), 0);
    const monthlyUsers = allUsers.filter(
      (u) => u.created_at >= startOfMonth
    ).length;

    // ── Chart data: last 6 months ─────────────────────────────────────────────
    const chartData = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(currentYear, currentMonth - i, 1);
      const monthEnd = new Date(currentYear, currentMonth - i + 1, 1);
      const monthLabel = monthStart.toLocaleDateString("en-US", { month: "short" });

      const monthOrders =
        recentOrders?.filter((o) => {
          const d = new Date(o.created_at);
          return d >= monthStart && d < monthEnd;
        }) ?? [];

      chartData.push({
        month: monthLabel,
        orders: monthOrders.length,
        revenue: monthOrders
          .filter((o) => REVENUE_STATUSES.includes(o.status))
          .reduce((sum, o) => sum + (o.total_amount ?? 0), 0),
        users: allUsers.filter((u) => {
          const d = new Date(u.created_at);
          return d >= monthStart && d < monthEnd;
        }).length,
      });
    }

    // ── Pending counts (useful for dashboard alerts) ───────────────────────────
    const pendingOrders =
      allOrders?.filter((o) => o.status === "payment_pending").length ?? 0;

    return NextResponse.json({
      stats: {
        totalOrders,
        totalRevenue,
        totalUsers,
        totalProducts: totalProducts ?? 0,
        monthlyRevenue,
        monthlyOrders,
        monthlyUsers,
        pendingOrders,
      },
      chartData,
    });
  } catch (error) {
    console.error("Error fetching analytics data:", error);
    return NextResponse.json({ error: "Failed to fetch analytics data" }, { status: 500 });
  }
}
