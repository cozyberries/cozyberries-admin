import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";


export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get current date and calculate date ranges
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const startOfLastMonth = new Date(currentYear, currentMonth - 1, 1);
    const endOfLastMonth = new Date(currentYear, currentMonth, 0);

    // Fetch total orders
    const { count: totalOrders } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "delivered");

    // Fetch monthly orders
    const { count: monthlyOrders } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "delivered")
      .gte("created_at", startOfMonth.toISOString());

    // Fetch total revenue
    const { data: revenueData } = await supabase
      .from("orders")
      .select("total_amount")
      .eq("status", "delivered");

    const totalRevenue = revenueData?.reduce((sum, order) => sum + order.total_amount, 0) || 0;

    // Fetch monthly revenue
    const { data: monthlyRevenueData } = await supabase
      .from("orders")
      .select("total_amount")
      .eq("status", "delivered")
      .gte("created_at", startOfMonth.toISOString());

    const monthlyRevenue = monthlyRevenueData?.reduce((sum, order) => sum + order.total_amount, 0) || 0;

    // Fetch total users (from auth.users)
    const { data: totalUsersData } = await supabase.auth.admin.listUsers();
    const totalUsersCount = totalUsersData?.users?.length || 0;

    // Fetch monthly users (approximate - count users created this month)
    const { data: monthlyUsersData } = await supabase.auth.admin.listUsers({
      perPage: 1000 // Get a large number to count users created this month
    });
    
    // Filter users created this month
    const monthlyUsersCount = monthlyUsersData?.users?.filter(user => 
      new Date(user.created_at) >= startOfMonth
    ).length || 0;

    // Fetch total products
    const { count: totalProducts } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true });

    // Generate chart data for the last 6 months
    const chartData = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth - i, 1);
      const nextDate = new Date(currentYear, currentMonth - i + 1, 1);
      
      const monthName = date.toLocaleDateString('en-US', { month: 'short' });
      
      // Get orders for this month
      const { count: monthOrders } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("status", "delivered")
        .gte("created_at", date.toISOString())
        .lt("created_at", nextDate.toISOString());

      // Get revenue for this month
      const { data: monthRevenueData } = await supabase
        .from("orders")
        .select("total_amount")
        .eq("status", "delivered")
        .gte("created_at", date.toISOString())
        .lt("created_at", nextDate.toISOString());

      const monthRevenue = monthRevenueData?.reduce((sum, order) => sum + order.total_amount, 0) || 0;

      // Get users for this month (approximate) - this is expensive but necessary for chart data
      const { data: monthUsersData } = await supabase.auth.admin.listUsers({
        perPage: 1000
      });
      
      const monthUsersCount = monthUsersData?.users?.filter(user => {
        const userCreatedAt = new Date(user.created_at);
        return userCreatedAt >= date && userCreatedAt < nextDate;
      }).length || 0;

      chartData.push({
        month: monthName,
        orders: monthOrders || 0,
        revenue: monthRevenue,
        users: monthUsersCount,
      });
    }

    const stats = {
      totalOrders: totalOrders || 0,
      totalRevenue,
      totalUsers: totalUsersCount,
      totalProducts: totalProducts || 0,
      monthlyRevenue,
      monthlyOrders: monthlyOrders || 0,
      monthlyUsers: monthlyUsersCount,
    };

    return NextResponse.json({
      stats,
      chartData,
    });

  } catch (error) {
    console.error("Error fetching analytics data:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics data" },
      { status: 500 }
    );
  }
}
