"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Calendar,
  BarChart3,
} from "lucide-react";
import { ExpenseSummary } from "@/lib/types/expense";
import { useAuthenticatedFetch } from "@/hooks/useAuthenticatedFetch";
import { toast } from "sonner";

export default function ExpenseAnalytics() {
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState("6months");

  const { fetch: authenticatedFetch } = useAuthenticatedFetch();

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetch("/api/expenses/summary");

      if (!response.ok) {
        throw new Error("Failed to fetch expense summary");
      }

      const data = await response.json();
      setSummary(data);
    } catch (error) {
      console.error("Error fetching expense summary:", error);
      toast.error("Failed to load expense analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchSummary is stable, selectedPeriod triggers refetch
  }, [selectedPeriod]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);
  };

  const calculateGrowthRate = () => {
    if (!summary || summary.monthly_trends.length < 2) return 0;

    const currentMonth =
      summary.monthly_trends[summary.monthly_trends.length - 1];
    const previousMonth =
      summary.monthly_trends[summary.monthly_trends.length - 2];

    if (previousMonth.total_amount === 0) return 100;

    return (
      ((currentMonth.total_amount - previousMonth.total_amount) /
        previousMonth.total_amount) *
      100
    );
  };

  const getTopCategory = () => {
    if (!summary || summary.category_breakdown.length === 0) return null;

    return summary.category_breakdown.reduce((top, current) =>
      current.total_amount > top.total_amount ? current : top
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Failed to load expense analytics</p>
      </div>
    );
  }

  const growthRate = calculateGrowthRate();
  const _topCategory = getTopCategory();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Expense Analytics</h2>
          <p className="text-xs text-gray-500">Overview of expense trends and statistics</p>
        </div>
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-full sm:w-[160px] h-8 text-xs">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3months">Last 3 Months</SelectItem>
            <SelectItem value="6months">Last 6 Months</SelectItem>
            <SelectItem value="1year">Last Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards — 2x2 on mobile, 4-col on lg */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
            <CardTitle className="text-xs font-medium text-gray-600">Total</CardTitle>
            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold">{summary.total_expenses}</div>
            <p className="text-xs text-muted-foreground truncate">
              {formatCurrency(summary.total_amount)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
            <CardTitle className="text-xs font-medium text-gray-600">Pending</CardTitle>
            <Clock className="h-3.5 w-3.5 text-yellow-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold truncate">
              {formatCurrency(summary.pending_amount)}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary.pending_expenses} items
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
            <CardTitle className="text-xs font-medium text-gray-600">Approved</CardTitle>
            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold truncate">
              {formatCurrency(summary.approved_amount)}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary.approved_expenses} items
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
            <CardTitle className="text-xs font-medium text-gray-600">Growth</CardTitle>
            {growthRate >= 0 ? (
              <TrendingUp className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-red-500" />
            )}
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className={`text-xl font-bold ${growthRate >= 0 ? "text-green-600" : "text-red-600"}`}>
              {growthRate >= 0 ? "+" : ""}{growthRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">vs last month</p>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown + Top Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center text-sm">
              <AlertTriangle className="mr-2 h-4 w-4" />
              Status Breakdown
            </CardTitle>
            <CardDescription className="text-xs">Distribution by status</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            {[
              { icon: Clock, color: "text-yellow-500", label: "Pending", count: summary.pending_expenses, amount: summary.pending_amount },
              { icon: CheckCircle, color: "text-green-500", label: "Approved", count: summary.approved_expenses, amount: summary.approved_amount },
              { icon: DollarSign, color: "text-blue-500", label: "Paid", count: summary.paid_expenses, amount: summary.paid_amount },
              { icon: XCircle, color: "text-red-500", label: "Rejected", count: summary.rejected_expenses, amount: summary.rejected_amount },
            ].map(({ icon: Icon, color, label, count, amount }) => (
              <div key={label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${color}`} />
                  <span className="text-sm">{label}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">{count}</div>
                  <div className="text-xs text-gray-500">{formatCurrency(amount)}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center text-sm">
              <BarChart3 className="mr-2 h-4 w-4" />
              Top Categories
            </CardTitle>
            <CardDescription className="text-xs">Expenses by category</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            {summary.category_breakdown
              .sort((a, b) => b.total_amount - a.total_amount)
              .slice(0, 5)
              .map((category, index) => (
                <div key={category.category} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      index === 0 ? "bg-blue-500" :
                      index === 1 ? "bg-green-500" :
                      index === 2 ? "bg-yellow-500" :
                      index === 3 ? "bg-purple-500" : "bg-gray-400"
                    }`} />
                    <span className="text-sm capitalize truncate">
                      {category.category.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <div className="text-sm font-semibold">{formatCurrency(category.total_amount)}</div>
                    <div className="text-xs text-gray-500">{category.count} items</div>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trends */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="flex items-center text-sm">
            <Calendar className="mr-2 h-4 w-4" />
            Monthly Trends
          </CardTitle>
          <CardDescription className="text-xs">Spending over time</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="space-y-2">
            {summary.monthly_trends.map((month, index) => {
              const isCurrentMonth = index === summary.monthly_trends.length - 1;
              const previousMonth = index > 0 ? summary.monthly_trends[index - 1] : null;
              const monthGrowth =
                previousMonth && previousMonth.total_amount > 0
                  ? ((month.total_amount - previousMonth.total_amount) / previousMonth.total_amount) * 100
                  : 0;

              return (
                <div
                  key={month.month}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium">
                        {new Date(month.month + "-01").toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                      </span>
                      {isCurrentMonth && (
                        <Badge variant="secondary" className="text-xs px-1.5 py-0">Current</Badge>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">{month.count} expenses</div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <div className="text-sm font-semibold">{formatCurrency(month.total_amount)}</div>
                    {previousMonth && (
                      <div className={`text-xs flex items-center justify-end ${monthGrowth >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {monthGrowth >= 0 ? <TrendingUp className="mr-0.5 h-3 w-3" /> : <TrendingDown className="mr-0.5 h-3 w-3" />}
                        {Math.abs(monthGrowth).toFixed(1)}%
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
