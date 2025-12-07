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

interface ExpenseAnalyticsProps {}

export default function ExpenseAnalytics({}: ExpenseAnalyticsProps) {
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState("6months");

  const { fetch: authenticatedFetch } = useAuthenticatedFetch();

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetch("/api/admin/expenses/summary");

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
  const topCategory = getTopCategory();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Expense Analytics</h2>
          <p className="text-gray-600">
            Overview of company expense trends and statistics
          </p>
        </div>
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3months">Last 3 Months</SelectItem>
            <SelectItem value="6months">Last 6 Months</SelectItem>
            <SelectItem value="1year">Last Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Expenses
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total_expenses}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(summary.total_amount)} total value
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Amount
            </CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary.pending_amount)}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary.pending_expenses} pending expenses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Approved Amount
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary.approved_amount)}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary.approved_expenses} approved expenses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Monthly Growth
            </CardTitle>
            {growthRate >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                growthRate >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {growthRate >= 0 ? "+" : ""}
              {growthRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">vs previous month</p>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangle className="mr-2 h-5 w-5" />
              Status Breakdown
            </CardTitle>
            <CardDescription>
              Distribution of expenses by status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Clock className="mr-2 h-4 w-4 text-yellow-500" />
                <span>Pending</span>
              </div>
              <div className="text-right">
                <div className="font-semibold">{summary.pending_expenses}</div>
                <div className="text-sm text-gray-500">
                  {formatCurrency(summary.pending_amount)}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                <span>Approved</span>
              </div>
              <div className="text-right">
                <div className="font-semibold">{summary.approved_expenses}</div>
                <div className="text-sm text-gray-500">
                  {formatCurrency(summary.approved_amount)}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <DollarSign className="mr-2 h-4 w-4 text-blue-500" />
                <span>Paid</span>
              </div>
              <div className="text-right">
                <div className="font-semibold">{summary.paid_expenses}</div>
                <div className="text-sm text-gray-500">
                  {formatCurrency(summary.paid_amount)}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <XCircle className="mr-2 h-4 w-4 text-red-500" />
                <span>Rejected</span>
              </div>
              <div className="text-right">
                <div className="font-semibold">{summary.rejected_expenses}</div>
                <div className="text-sm text-gray-500">
                  {formatCurrency(summary.rejected_amount)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="mr-2 h-5 w-5" />
              Top Categories
            </CardTitle>
            <CardDescription>Expenses by category</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {summary.category_breakdown
              .sort((a, b) => b.total_amount - a.total_amount)
              .slice(0, 5)
              .map((category, index) => (
                <div
                  key={category.category}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center">
                    <div
                      className={`w-3 h-3 rounded-full mr-3 ${
                        index === 0
                          ? "bg-blue-500"
                          : index === 1
                          ? "bg-green-500"
                          : index === 2
                          ? "bg-yellow-500"
                          : index === 3
                          ? "bg-purple-500"
                          : "bg-gray-500"
                      }`}
                    />
                    <span className="capitalize">
                      {category.category.replace("_", " ")}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">
                      {formatCurrency(category.total_amount)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {category.count} expenses
                    </div>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="mr-2 h-5 w-5" />
            Monthly Trends
          </CardTitle>
          <CardDescription>
            Expense trends over the last 6 months
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {summary.monthly_trends.map((month, index) => {
              const isCurrentMonth =
                index === summary.monthly_trends.length - 1;
              const previousMonth =
                index > 0 ? summary.monthly_trends[index - 1] : null;
              const monthGrowth =
                previousMonth && previousMonth.total_amount > 0
                  ? ((month.total_amount - previousMonth.total_amount) /
                      previousMonth.total_amount) *
                    100
                  : 0;

              return (
                <div
                  key={month.month}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div>
                    <div className="font-semibold">
                      {new Date(month.month + "-01").toLocaleDateString(
                        "en-US",
                        {
                          year: "numeric",
                          month: "long",
                        }
                      )}
                      {isCurrentMonth && (
                        <Badge className="ml-2" variant="secondary">
                          Current
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {month.count} expenses
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-lg">
                      {formatCurrency(month.total_amount)}
                    </div>
                    {previousMonth && (
                      <div
                        className={`text-sm flex items-center ${
                          monthGrowth >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {monthGrowth >= 0 ? (
                          <TrendingUp className="mr-1 h-3 w-3" />
                        ) : (
                          <TrendingDown className="mr-1 h-3 w-3" />
                        )}
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
