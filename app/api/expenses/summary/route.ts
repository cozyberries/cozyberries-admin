import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-server";
import { authenticateRequest } from "@/lib/jwt-auth";
import { ExpenseCategory, ExpenseSummary } from "@/lib/types/expense";

type ExpenseRow = {
  amount: number;
  expense_date: string;
  status?: string;
  category_data?: { name: string; display_name: string } | null;
};

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);

    if (!auth.isAuthenticated || !auth.isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const supabase = createAdminSupabaseClient();
    const expenses = await fetchExpenses(supabase);

    return NextResponse.json(buildSummary(expenses));

  } catch (error) {
    console.error("Error fetching expense summary:", error);
    return NextResponse.json({ error: "Failed to fetch expense summary" }, { status: 500 });
  }
}

// Cached schema capabilities — probed once per process lifetime
let schemaProbed = false;
let hasStatusColumn = false;
let hasCategoryJoin = false;
let probePromise: Promise<void> | null = null;

/**
 * Probe the expenses table schema once to discover available columns/joins.
 * Uses a shared promise to serialize concurrent callers — only one set of
 * probe queries ever runs, and all concurrent requests await the same result.
 */
async function probeSchema(supabase: ReturnType<typeof createAdminSupabaseClient>): Promise<void> {
  if (schemaProbed) return;
  if (probePromise) return probePromise;

  probePromise = (async () => {
    // Check if category join works
    const { error: catErr } = await supabase
      .from("expenses")
      .select("amount, category_data:expense_categories(name, display_name)")
      .limit(0);
    hasCategoryJoin = !catErr;

    // Check if status column exists
    const { error: statusErr } = await supabase
      .from("expenses")
      .select("amount, status")
      .limit(0);
    hasStatusColumn = !statusErr;

    schemaProbed = true;
    probePromise = null;
  })();

  return probePromise;
}

async function fetchExpenses(supabase: ReturnType<typeof createAdminSupabaseClient>): Promise<ExpenseRow[]> {
  await probeSchema(supabase);

  // Build select string based on known schema capabilities
  const columns = ["amount", "expense_date"];
  if (hasStatusColumn) columns.push("status");

  let selectStr = columns.join(", ");
  if (hasCategoryJoin) {
    selectStr += ", category_data:expense_categories(name, display_name)";
  }

  const { data, error } = await supabase
    .from("expenses")
    .select(selectStr)
    .returns<ExpenseRow[]>();

  if (error) throw new Error(`Failed to fetch expenses: ${error.message}`);
  return data || [];
}

function buildSummary(expenses: ExpenseRow[]): ExpenseSummary {
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

  // === STATUS BREAKDOWN ===
  const hasStatus = expenses.some(e => e.status != null);
  if (hasStatus) {
    const statusGroups: Record<string, { count: number; amount: number }> = {};
    for (const e of expenses) {
      const s = e.status ?? "unknown";
      if (!statusGroups[s]) statusGroups[s] = { count: 0, amount: 0 };
      statusGroups[s].count += 1;
      statusGroups[s].amount += e.amount || 0;
    }
    summary.pending_expenses = statusGroups["pending"]?.count || 0;
    summary.approved_expenses = statusGroups["approved"]?.count || 0;
    summary.rejected_expenses = statusGroups["rejected"]?.count || 0;
    summary.paid_expenses = statusGroups["paid"]?.count || 0;
    summary.pending_amount = statusGroups["pending"]?.amount || 0;
    summary.approved_amount = statusGroups["approved"]?.amount || 0;
    summary.rejected_amount = statusGroups["rejected"]?.amount || 0;
    summary.paid_amount = statusGroups["paid"]?.amount || 0;
  }

  // === MONTHLY TRENDS (last 6 months) ===
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const cutoff = sixMonthsAgo.toISOString().substring(0, 7); // YYYY-MM

  const monthlyGroups: Record<string, { total_amount: number; count: number }> = {};

  expenses
    .filter(e => {
      if (!e.expense_date) return false;
      const month = e.expense_date.substring(0, 7);
      return month >= cutoff;
    })
    .forEach(e => {
      const month = e.expense_date.substring(0, 7); // YYYY-MM
      if (!monthlyGroups[month]) monthlyGroups[month] = { total_amount: 0, count: 0 };
      monthlyGroups[month].total_amount += e.amount || 0;
      monthlyGroups[month].count += 1;
    });

  summary.monthly_trends = Object.entries(monthlyGroups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      total_amount: data.total_amount,
      count: data.count,
    }));

  // === CATEGORY BREAKDOWN ===
  const hasCategories = expenses.some(e => e.category_data != null);
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
