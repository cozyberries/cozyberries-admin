import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-server";
import { authenticateRequest } from "@/lib/jwt-auth";

// Revenue-counted statuses: money has been collected
const REVENUE_STATUSES = ["payment_confirmed", "processing", "shipped", "delivered"];

interface OrderRevenueAgg {
  sum: string | number | null;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);

    if (!auth.isAuthenticated || !auth.isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const supabase = createAdminSupabaseClient();

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const startOfMonth = new Date(currentYear, currentMonth, 1).toISOString();

    // Six months ago for chart data
    const sixMonthsAgo = new Date(currentYear, currentMonth - 5, 1).toISOString();

    // Fetch orders from the last 6 months for chart rendering
    const { data: recentOrders } = await supabase
      .from("orders")
      .select("id, total_amount, status, created_at")
      .gte("created_at", sixMonthsAgo)
      .order("created_at", { ascending: false });

    // ── Lifetime aggregates (no full table scan) ───────────────────────────────
    const { count: totalOrders } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true });

    const { data: revenueAgg } = await supabase
      .from("orders")
      .select("total_amount.sum()")
      .in("status", REVENUE_STATUSES);
    const totalRevenue = Number((revenueAgg as OrderRevenueAgg[])?.[0]?.sum ?? 0);

    const { count: pendingOrders } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "payment_pending");

    // ── This month stats ──────────────────────────────────────────────────────
    const { data: thisMonthRows } = await supabase
      .from("orders")
      .select("total_amount, status")
      .gte("created_at", startOfMonth);
    const monthlyOrders = thisMonthRows?.length ?? 0;
    const monthlyRevenue =
      thisMonthRows
        ?.filter((o) => REVENUE_STATUSES.includes(o.status))
        .reduce((sum, o) => sum + (o.total_amount ?? 0), 0) ?? 0;

    // Products count
    const { count: totalProducts } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true });

    // ── Users — paginated to handle > 1,000 users ─────────────────────────────
    const firstPage = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const allUsers = [...(firstPage.data?.users ?? [])];
    const MAX_PAGES = 100;
    if ((firstPage.data?.users?.length ?? 0) >= 1000) {
      let page = 2;
      while (page <= MAX_PAGES) {
        const { data: pageData, error: pageError } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
        if (pageError || !pageData?.users?.length) break;
        allUsers.push(...pageData.users);
        if (pageData.users.length < 1000) break;
        if (page === MAX_PAGES) {
          console.warn(
            `[analytics] listUsers pagination truncated at MAX_PAGES=${MAX_PAGES} (perPage=1000); ` +
              `collected ${allUsers.length} users through page ${page}; actual total may be higher.`
          );
          break;
        }
        page++;
      }
    }

    const totalUsers = allUsers.length;
    const startOfMonthMs = Date.parse(startOfMonth);
    const monthlyUsers = allUsers.filter((u) => Date.parse(u.created_at) >= startOfMonthMs).length;

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

    return NextResponse.json({
      stats: {
        totalOrders: totalOrders ?? 0,
        totalRevenue,
        totalUsers,
        totalProducts: totalProducts ?? 0,
        monthlyRevenue,
        monthlyOrders,
        monthlyUsers,
        pendingOrders: pendingOrders ?? 0,
      },
      chartData,
    });
  } catch (error) {
    console.error("Error fetching analytics data:", error);
    return NextResponse.json({ error: "Failed to fetch analytics data" }, { status: 500 });
  }
}
