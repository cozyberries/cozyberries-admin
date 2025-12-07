"use client";

import { useEffect, useState } from "react";
import {
  ShoppingCart,
  Users,
  DollarSign,
  TrendingUp,
  Package,
  Calendar
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ExpenseDashboard from "@/components/admin/ExpenseDashboard";

interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  totalUsers: number;
  totalProducts: number;
  monthlyRevenue: number;
  monthlyOrders: number;
  monthlyUsers: number;
}

interface ChartData {
  month: string;
  orders: number;
  revenue: number;
  users: number;
}

interface Activity {
  id: string;
  type: string;
  title: string;
  created_at: string;
}

export default function AnalyticsDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    totalRevenue: 0,
    totalUsers: 0,
    totalProducts: 0,
    monthlyRevenue: 0,
    monthlyOrders: 0,
    monthlyUsers: 0,
  });
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<Activity[]>([]);

  // Fetch all activities data
  useEffect(() => {
    async function fetchActivities() {
      try {
        const res = await fetch("/api/activities");
        if (res.ok) {
          const data = await res.json();
          setActivities(data || []);
        } else {
          console.error("Failed to load activities: ", res.statusText);
          setActivities([]);
        }
      } catch (error) {
        console.error("Failed to load activities", error);
        setActivities([]);
      }
    }
    fetchActivities();
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch analytics data from API
      const response = await fetch('/api/admin/analytics');
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
        setChartData(data.chartData);
      } else {
        // Fallback mock data for development
        setStats({
          totalOrders: 0,
          totalRevenue: 0,
          totalUsers: 0,
          totalProducts: 0,
          monthlyRevenue: 0,
          monthlyOrders: 0,
          monthlyUsers: 0,
        });

        setChartData([
          { month: 'Jan', orders: 0, revenue: 0, users: 0 },
          { month: 'Feb', orders: 0, revenue: 0, users: 0 },
          { month: 'Mar', orders: 0, revenue: 0, users: 0 },
          { month: 'Apr', orders: 0, revenue: 0, users: 0 },
          { month: 'May', orders: 0, revenue: 0, users: 0 },
          { month: 'Jun', orders: 0, revenue: 0, users: 0 },
        ]);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setStats({
        totalOrders: 0,
        totalRevenue: 284750,
        totalUsers: 892,
        totalProducts: 156,
        monthlyRevenue: 45230,
        monthlyOrders: 189,
        monthlyUsers: 67,
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-IN').format(num);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome to your admin dashboard</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ShoppingCart className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Orders</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {formatNumber(stats.totalOrders)}
                </p>
                <p className="text-sm text-green-600">
                  +{stats.monthlyOrders} this month
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <DollarSign className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Revenue</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {formatCurrency(stats.totalRevenue)}
                </p>
                <p className="text-sm text-green-600">
                  +{formatCurrency(stats.monthlyRevenue)} this month
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Users className="h-8 w-8 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Users</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {formatNumber(stats.totalUsers)}
                </p>
                <p className="text-sm text-green-600">
                  +{stats.monthlyUsers} this month
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Package className="h-8 w-8 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Products</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {formatNumber(stats.totalProducts)}
                </p>
                <p className="text-sm text-gray-500">
                  Active products
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              Monthly Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-end justify-between space-x-2">
              {chartData.map((data) => {
                const maxRevenue = chartData.length > 0 
                  ? Math.max(...chartData.map(d => d.revenue), 1) 
                  : 1;
                const heightPercentage = maxRevenue > 0 
                  ? (data.revenue / maxRevenue) * 200 
                  : 0;
                return (
                  <div key={data.month} className="flex flex-col items-center flex-1">
                    <div
                      className="bg-blue-500 rounded-t w-full transition-all duration-300 hover:bg-blue-600"
                      style={{
                        height: `${heightPercentage}px`,
                        minHeight: '20px'
                      }}
                      title={`${data.month}: ${formatCurrency(data.revenue)}`}
                    />
                    <span className="text-xs text-gray-500 mt-2">{data.month}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Orders Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Monthly Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-end justify-between space-x-2">
              {chartData.map((data) => {
                const maxOrders = chartData.length > 0 
                  ? Math.max(...chartData.map(d => d.orders), 1) 
                  : 1;
                const heightPercentage = maxOrders > 0 
                  ? (data.orders / maxOrders) * 200 
                  : 0;
                return (
                  <div key={data.month} className="flex flex-col items-center flex-1">
                    <div
                      className="bg-green-500 rounded-t w-full transition-all duration-300 hover:bg-green-600"
                      style={{
                        height: `${heightPercentage}px`,
                        minHeight: '20px'
                      }}
                      title={`${data.month}: ${data.orders} orders`}
                    />
                    <span className="text-xs text-gray-500 mt-2">{data.month}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expense Management Section */}
      <ExpenseDashboard />

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length > 0 ? (
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              {activities.map((activity) => (
                <div key={activity.id}>
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{activity.title}</p>
                      <p className="text-sm text-gray-500">{new Date(activity.created_at).toLocaleDateString()} {new Date(activity.created_at).toLocaleTimeString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500">No activities found</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
