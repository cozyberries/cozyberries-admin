import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { authenticateRequest } from "@/lib/jwt-auth";
import { ExpenseCategory, ExpenseSummary } from "@/lib/types/expense";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);

    if (!auth.isAuthenticated || !auth.isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const supabase = await createServerSupabaseClient();

    // Fetch all expenses with status and amount
    const { data: expenses, error: fetchError } = await supabase
      .from("expenses")
      .select("status, amount, expense_date, category");

    if (fetchError) {
      console.error("Supabase fetch error:", fetchError);
      return NextResponse.json({ error: "Failed to fetch expenses" }, { status: 500 });
    }

    if (!expenses || expenses.length === 0) {
      return NextResponse.json({
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
      });
    }

    // === SUMMARY COUNTS ===
    const summary: ExpenseSummary = {
      total_expenses: expenses.length,
      total_amount: expenses.reduce((sum, e) => sum + (e.amount || 0), 0),
      pending_expenses: expenses.filter(e => e.status === "pending").length,
      approved_expenses: expenses.filter(e => e.status === "approved").length,
      rejected_expenses: expenses.filter(e => e.status === "rejected").length,
      paid_expenses: expenses.filter(e => e.status === "paid").length,
      pending_amount: expenses.filter(e => e.status === "pending").reduce((sum, e) => sum + (e.amount || 0), 0),
      approved_amount: expenses.filter(e => e.status === "approved").reduce((sum, e) => sum + (e.amount || 0), 0),
      rejected_amount: expenses.filter(e => e.status === "rejected").reduce((sum, e) => sum + (e.amount || 0), 0),
      paid_amount: expenses.filter(e => e.status === "paid").reduce((sum, e) => sum + (e.amount || 0), 0),
      monthly_trends: [],
      category_breakdown: []
    };

    // === MONTHLY TRENDS ===
    // Get current month and year
    const now = new Date();
    const currentMonth = now.getMonth(); // 0–11
    const currentYear = now.getFullYear();

    const monthlyGroups: Record<string, { total_amount: number; count: number }> = {};

    expenses
      ?.filter(e => {
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
    const categoryGroups: Record<string, { total_amount: number; count: number }> = {};

    expenses.forEach(exp => {
      const cat = exp.category || "Uncategorized";
      if (!categoryGroups[cat]) categoryGroups[cat] = { total_amount: 0, count: 0 };
      categoryGroups[cat].total_amount += exp.amount || 0;
      categoryGroups[cat].count += 1;
    });

    summary.category_breakdown = Object.entries(categoryGroups).map(([category, data]) => ({
      category: category as ExpenseCategory,
      total_amount: data.total_amount,
      count: data.count
    }));

    // Return real data (no mock)
    return NextResponse.json(summary);

  } catch (error) {
    console.error("Error fetching expense summary:", error);
    return NextResponse.json({ error: "Failed to fetch expense summary" }, { status: 500 });
  }
}
