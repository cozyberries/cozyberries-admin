"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ShoppingCart,
  Users,
  IndianRupee,
  Package,
  Clock,
  TrendingUp,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useAuthenticatedFetch } from "@/hooks/useAuthenticatedFetch";

interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  totalUsers: number;
  totalProducts: number;
  monthlyRevenue: number;
  monthlyOrders: number;
  monthlyUsers: number;
  pendingOrders: number;
}

interface ChartData {
  month: string;
  orders: number;
  revenue: number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

const fmtShort = (n: number) => {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n}`;
};

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconClass,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  iconClass: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs text-gray-500 font-medium">{label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5 leading-none">{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
          </div>
          <div className={`p-2 rounded-lg shrink-0 ml-2 ${iconClass}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SkeletonCard() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-3 bg-gray-200 rounded w-2/3" />
          <div className="h-7 bg-gray-200 rounded w-1/2" />
          <div className="h-3 bg-gray-200 rounded w-3/4" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function AnalyticsDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { get } = useAuthenticatedFetch();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await get("/api/analytics", { requireAdmin: true });
      const data = await res.json();
      setStats(data.stats);
      setChartData(data.chartData ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-xs text-gray-400">Store overview</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={fetchData}
          disabled={loading}
          className="h-8 w-8"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Pending orders alert */}
      {!loading && stats && stats.pendingOrders > 0 && (
        <Link href="/orders">
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors">
            <Clock className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800 font-medium">
              {stats.pendingOrders} order{stats.pendingOrders !== 1 ? "s" : ""} awaiting payment confirmation
            </p>
          </div>
        </Link>
      )}

      {/* Stat cards — 2 col on mobile, 4 col on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {loading ? (
          [...Array(4)].map((_, i) => <SkeletonCard key={i} />)
        ) : stats ? (
          <>
            <StatCard
              label="Total Orders"
              value={stats.totalOrders.toLocaleString("en-IN")}
              sub={`+${stats.monthlyOrders} this month`}
              icon={ShoppingCart}
              iconClass="bg-blue-50 text-blue-600"
            />
            <StatCard
              label="Revenue"
              value={fmtShort(stats.totalRevenue)}
              sub={`+${fmtShort(stats.monthlyRevenue)} this month`}
              icon={IndianRupee}
              iconClass="bg-green-50 text-green-600"
            />
            <StatCard
              label="Customers"
              value={stats.totalUsers.toLocaleString("en-IN")}
              sub={`+${stats.monthlyUsers} this month`}
              icon={Users}
              iconClass="bg-purple-50 text-purple-600"
            />
            <StatCard
              label="Products"
              value={stats.totalProducts.toLocaleString("en-IN")}
              sub="Active listings"
              icon={Package}
              iconClass="bg-orange-50 text-orange-600"
            />
          </>
        ) : null}
      </div>

      {/* Charts — stacked on mobile, 2-col on desktop */}
      {!loading && chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-green-600" />
                Monthly Revenue
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={fmtShort}
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                  />
                  <Tooltip
                    formatter={(v: number) => [fmt(v), "Revenue"]}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Bar dataKey="revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <ShoppingCart className="h-4 w-4 text-blue-600" />
                Monthly Orders
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                    width={32}
                    allowDecimals={false}
                  />
                  <Tooltip
                    formatter={(v: number) => [v, "Orders"]}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Bar dataKey="orders" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick nav links */}
      {!loading && (
        <div className="grid grid-cols-2 gap-3">
          <Link href="/orders">
            <Card className="hover:bg-gray-50 transition-colors cursor-pointer">
              <CardContent className="p-4 flex items-center gap-3">
                <ShoppingCart className="h-5 w-5 text-blue-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">Orders</p>
                  <p className="text-xs text-gray-400">Manage all orders</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/users">
            <Card className="hover:bg-gray-50 transition-colors cursor-pointer">
              <CardContent className="p-4 flex items-center gap-3">
                <Users className="h-5 w-5 text-purple-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">Users</p>
                  <p className="text-xs text-gray-400">View customers</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/products">
            <Card className="hover:bg-gray-50 transition-colors cursor-pointer">
              <CardContent className="p-4 flex items-center gap-3">
                <Package className="h-5 w-5 text-orange-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">Products</p>
                  <p className="text-xs text-gray-400">Manage listings</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/expenses">
            <Card className="hover:bg-gray-50 transition-colors cursor-pointer">
              <CardContent className="p-4 flex items-center gap-3">
                <IndianRupee className="h-5 w-5 text-red-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">Expenses</p>
                  <p className="text-xs text-gray-400">Track spending</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}
    </div>
  );
}
