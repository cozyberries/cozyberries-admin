"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Receipt,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  Plus,
  ArrowRight,
} from "lucide-react";
import { ExpenseSummary, Expense } from "@/lib/types/expense";
import { useAuthenticatedFetch } from "@/hooks/useAuthenticatedFetch";

interface ExpenseDashboardProps {
  className?: string;
}

export default function ExpenseDashboard({ className }: ExpenseDashboardProps) {
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const { fetch: authenticatedFetch } = useAuthenticatedFetch();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch summary and recent expenses in parallel
        const [summaryResponse, expensesResponse] = await Promise.all([
          authenticatedFetch("/api/admin/expenses/summary"),
          authenticatedFetch("/api/admin/expenses?limit=5"),
        ]);

        if (summaryResponse.ok) {
          const summaryData = await summaryResponse.json();
          setSummary(summaryData);
        }

        if (expensesResponse.ok) {
          const expensesData = await expensesResponse.json();
          setRecentExpenses(expensesData.expenses || []);
        }
      } catch (error) {
        console.error("Error fetching expense dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
    });
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

  const statusColors = {
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
    paid: "bg-blue-100 text-blue-800",
    cancelled: "bg-gray-100 text-gray-800",
  };

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const growthRate = calculateGrowthRate();

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Expense Overview</h2>
          <p className="text-gray-600">Quick overview of company expenses</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/expenses">
            <Button variant="outline">
              <Eye className="mr-2 h-4 w-4" />
              View All
            </Button>
          </Link>
          <Link href="/admin/expenses">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Expense
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Expenses
            </CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.total_expenses || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(summary?.total_amount || 0)} total value
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.pending_expenses || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(summary?.pending_amount || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(
                summary?.monthly_trends[summary.monthly_trends.length - 1]
                  ?.total_amount || 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary?.monthly_trends[summary.monthly_trends.length - 1]
                ?.count || 0}{" "}
              expenses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Growth</CardTitle>
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
            <p className="text-xs text-muted-foreground">vs last month</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Expenses and Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Expenses */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Expenses</CardTitle>
              <CardDescription>Latest expense submissions</CardDescription>
            </div>
            <Link href="/admin/expenses">
              <Button variant="ghost" size="sm">
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentExpenses.length > 0 ? (
                recentExpenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {expense.title}
                        </p>
                        <Badge className={statusColors[expense.status]}>
                          {expense.status.charAt(0).toUpperCase() +
                            expense.status.slice(1)}
                        </Badge>
                      </div>
                      <div className="flex items-center text-sm text-gray-500">
                        <span className="truncate">
                          {expense.user_profiles?.full_name}
                        </span>
                        <span className="mx-2">•</span>
                        <span>{formatDate(expense.created_at)}</span>
                      </div>
                    </div>
                    <div className="ml-4 text-right">
                      <p className="text-sm font-semibold">
                        {formatCurrency(expense.amount)}
                      </p>
                      <p className="text-xs text-gray-500 capitalize">
                        {expense.category.replace("_", " ")}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <Receipt className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                  <p>No recent expenses</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangle className="mr-2 h-5 w-5" />
              Status Overview
            </CardTitle>
            <CardDescription>Expense approval status breakdown</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Clock className="mr-2 h-4 w-4 text-yellow-500" />
                <span>Pending Approval</span>
              </div>
              <div className="text-right">
                <div className="font-semibold">
                  {summary?.pending_expenses || 0}
                </div>
                <div className="text-sm text-gray-500">
                  {formatCurrency(summary?.pending_amount || 0)}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                <span>Approved</span>
              </div>
              <div className="text-right">
                <div className="font-semibold">
                  {summary?.approved_expenses || 0}
                </div>
                <div className="text-sm text-gray-500">
                  {formatCurrency(summary?.approved_amount || 0)}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <DollarSign className="mr-2 h-4 w-4 text-blue-500" />
                <span>Paid</span>
              </div>
              <div className="text-right">
                <div className="font-semibold">
                  {summary?.paid_expenses || 0}
                </div>
                <div className="text-sm text-gray-500">
                  {formatCurrency(summary?.paid_amount || 0)}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <XCircle className="mr-2 h-4 w-4 text-red-500" />
                <span>Rejected</span>
              </div>
              <div className="text-right">
                <div className="font-semibold">
                  {summary?.rejected_expenses || 0}
                </div>
                <div className="text-sm text-gray-500">
                  {formatCurrency(summary?.rejected_amount || 0)}
                </div>
              </div>
            </div>

            {summary && summary.pending_expenses > 0 && (
              <div className="pt-4 border-t">
                <Link href="/admin/expenses?status=pending">
                  <Button variant="outline" className="w-full">
                    Review Pending Expenses
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
