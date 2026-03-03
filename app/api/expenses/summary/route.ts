import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-server";
import { authenticateRequest } from "@/lib/jwt-auth";
import { ExpenseCategory, ExpenseSummary } from "@/lib/types/expense";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);

    if (!auth.isAuthenticated || !auth.isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const supabase = createAdminSupabaseClient();

    // Fetch expenses with category data via FK join
    // Use category_data join instead of direct category column
    const { data: expenses, error: fetchError } = await supabase
      .from("expenses")
      .select("amount, expense_date, category_data:expense_categories(name, display_name)");

    if (fetchError) {
      // If the join fails (e.g., no category_id FK), fall back to just amount + date
      console.warn("Supabase fetch with join failed, trying without category:", fetchError);
      const { data: fallbackExpenses, error: fallbackError } = await supabase
        .from("expenses")
        .select("amount, expense_date");

      if (fallbackError) {
        console.warn("Supabase fetch error:", fallbackError);
        return NextResponse.json({ error: "Failed to fetch expenses" }, { status: 500 });
      }

      return NextResponse.json(buildSummary(fallbackExpenses || [], false));
    }

    return NextResponse.json(buildSummary(expenses || [], true));

  } catch (error) {
    console.error("Error fetching expense summary:", error);
    return NextResponse.json({ error: "Failed to fetch expense summary" }, { status: 500 });
  }
}

function buildSummary(
  expenses: Array<{ amount: number; expense_date: string; category_data?: { name: string; display_name: string } | null }>,
  hasCategories: boolean
): ExpenseSummary {
  const emptySummary: ExpenseSummary = {
    total_expenses: 0,
    total_amount: 0,
    pending_expenses: 0,
    approved_expenses: 0,
    rejected_expenses: 0,
    paid_expenses: 0,
    pending_amount: 0,
    approved_amount: 0,
    rejected_amount: 0,
    paid_amount: 0,
    monthly_trends: [],
    category_breakdown: []
  };

  if (expenses.length === 0) {
    return emptySummary;
  }

  const summary: ExpenseSummary = {
    ...emptySummary,
    total_expenses: expenses.length,
    total_amount: expenses.reduce((sum, e) => sum + (e.amount || 0), 0),
  };

  // === MONTHLY TRENDS ===
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthlyGroups: Record<string, { total_amount: number; count: number }> = {};

  expenses
    .filter(e => {
      if (!e.expense_date) return false;
      const date = new Date(e.expense_date);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    })
    .forEach(e => {
      const month = e.expense_date.substring(0, 7); // YYYY-MM
      if (!monthlyGroups[month]) monthlyGroups[month] = { total_amount: 0, count: 0 };
      monthlyGroups[month].total_amount += e.amount || 0;
      monthlyGroups[month].count += 1;
    });

  summary.monthly_trends = Object.entries(monthlyGroups).map(([month, data]) => ({
    month,
    total_amount: data.total_amount,
    count: data.count,
  }));

  // === CATEGORY BREAKDOWN ===
  if (hasCategories) {
    const categoryGroups: Record<string, { total_amount: number; count: number }> = {};

    expenses.forEach(exp => {
      const cat = exp.category_data?.display_name || exp.category_data?.name || "Uncategorized";
      if (!categoryGroups[cat]) categoryGroups[cat] = { total_amount: 0, count: 0 };
      categoryGroups[cat].total_amount += exp.amount || 0;
      categoryGroups[cat].count += 1;
    });

    summary.category_breakdown = Object.entries(categoryGroups).map(([category, data]) => ({
      category: category as ExpenseCategory,
      total_amount: data.total_amount,
      count: data.count
    }));
  }

  return summary;
}
