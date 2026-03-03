"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Check,
  X,
  IndianRupee,
  User,
  CheckCircle,
  Clock,
  XCircle,
  SlidersHorizontal,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { Expense, ExpenseStatus, ExpenseCategoryData } from "@/lib/types/expense";
import ExpenseForm from "./ExpenseForm";
import { useAuthenticatedFetch } from "@/hooks/useAuthenticatedFetch";
import { toast } from "sonner";

const statusColors: Record<ExpenseStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  paid: "bg-blue-100 text-blue-800",
  cancelled: "bg-gray-100 text-gray-800",
};

const statusIcons: Record<ExpenseStatus, React.ElementType> = {
  pending: Clock,
  approved: CheckCircle,
  rejected: XCircle,
  paid: IndianRupee,
  cancelled: X,
};

const priorityColors = {
  low: "bg-gray-100 text-gray-700",
  medium: "bg-blue-100 text-blue-800",
  high: "bg-orange-100 text-orange-800",
  urgent: "bg-red-100 text-red-800",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

// ── Full-screen slide modal (avoids Dialog overflow bugs on mobile) ───────────
function SlideModal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <h2 className="text-base font-semibold">{title}</h2>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">{children}</div>
    </div>
  );
}

// ── Detail view ───────────────────────────────────────────────────────────────
function ExpenseDetail({
  expense,
  onClose,
  getCategoryLabel,
}: {
  expense: Expense;
  onClose: () => void;
  getCategoryLabel: (e: Expense) => string;
}) {
  return (
    <SlideModal open title="Expense Details" onClose={onClose}>
      <div className="space-y-4 max-w-lg mx-auto">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 font-medium">Title</p>
            <p className="font-semibold mt-0.5">{expense.title}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Amount</p>
            <p className="font-semibold mt-0.5">{fmt(expense.amount)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 font-medium">Category</p>
            <p className="mt-0.5">{getCategoryLabel(expense)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Priority</p>
            <Badge className={`mt-0.5 ${priorityColors[expense.priority]}`}>
              {expense.priority}
            </Badge>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 font-medium">Status</p>
            <Badge className={`mt-0.5 ${statusColors[expense.status]}`}>{expense.status}</Badge>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Date</p>
            <p className="mt-0.5">{fmtDate(expense.expense_date)}</p>
          </div>
        </div>
        {expense.vendor && (
          <div>
            <p className="text-xs text-gray-500 font-medium">Vendor</p>
            <p className="mt-0.5">{expense.vendor}</p>
          </div>
        )}
        {expense.description && (
          <div>
            <p className="text-xs text-gray-500 font-medium">Description</p>
            <p className="mt-0.5 text-sm text-gray-700">{expense.description}</p>
          </div>
        )}
        {expense.notes && (
          <div>
            <p className="text-xs text-gray-500 font-medium">Notes</p>
            <p className="mt-0.5 text-sm text-gray-700">{expense.notes}</p>
          </div>
        )}
        {expense.rejected_reason && (
          <div>
            <p className="text-xs text-gray-500 font-medium">Rejection Reason</p>
            <p className="mt-0.5 text-sm text-red-600">{expense.rejected_reason}</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 font-medium">Submitted by</p>
            <p className="mt-0.5 text-sm">
              {expense.user_profiles?.full_name || expense.user_profiles?.email || "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Created</p>
            <p className="mt-0.5 text-sm">{fmtDate(expense.created_at)}</p>
          </div>
        </div>
      </div>
    </SlideModal>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ExpenseManagement() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: "all",
    category: "all",
    priority: "all",
    search: "",
  });
  const [showFilters, setShowFilters] = useState(false);
  const [categories, setCategories] = useState<ExpenseCategoryData[]>([]);

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selected, setSelected] = useState<Expense | null>(null);

  const { fetch: authFetch } = useAuthenticatedFetch();

  const fetchCategories = useCallback(async () => {
    try {
      const res = await authFetch("/api/expense-categories", { silent: true });
      const data = await res.json();
      setCategories(data.categories || []);
    } catch {
      // cosmetic — silently ignore
    }
  }, [authFetch]);

  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const params = new URLSearchParams();
      if (filters.status !== "all") params.append("status", filters.status);
      if (filters.category !== "all") params.append("category", filters.category);
      if (filters.priority !== "all") params.append("priority", filters.priority);
      if (filters.search) params.append("search", filters.search);
      const res = await authFetch(`/api/expenses?${params}`);
      const data = await res.json();
      setExpenses(data.expenses || []);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }, [authFetch, filters]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const handleStatusUpdate = async (
    id: string,
    status: ExpenseStatus,
    rejectedReason?: string
  ) => {
    try {
      const res = await authFetch(`/api/expenses/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          status,
          ...(rejectedReason && { rejected_reason: rejectedReason }),
        }),
      });
      const updated = await res.json();
      setExpenses((prev) => prev.map((e) => (e.id === id ? updated : e)));
      toast.success(`Expense ${status}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update expense");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await authFetch(`/api/expenses/${id}`, { method: "DELETE" });
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      toast.success("Expense deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete expense");
    }
  };

  const handleFormSuccess = () => {
    setShowCreate(false);
    setShowEdit(false);
    setSelected(null);
    fetchExpenses();
  };

  const getCategoryLabel = (expense: Expense) => {
    if (expense.category_data) return expense.category_data.display_name;
    const cat = categories.find((c) => c.name === expense.category);
    return cat?.display_name || expense.category;
  };

  const getCategoryColor = (expense: Expense) => {
    if (expense.category_data) return expense.category_data.color;
    const cat = categories.find((c) => c.name === expense.category);
    return cat?.color || "#6B7280";
  };

  const hasActiveFilter =
    filters.status !== "all" ||
    filters.category !== "all" ||
    filters.priority !== "all" ||
    !!filters.search;

  return (
    <>
      {/* Modals — full-screen, no overflow issues on mobile */}
      {showCreate && (
        <SlideModal open title="Add Expense" onClose={() => setShowCreate(false)}>
          <div className="max-w-2xl mx-auto">
            <ExpenseForm
              onSuccess={handleFormSuccess}
              onCancel={() => setShowCreate(false)}
              isEdit={false}
            />
          </div>
        </SlideModal>
      )}
      {showEdit && selected && (
        <SlideModal
          open
          title="Edit Expense"
          onClose={() => {
            setShowEdit(false);
            setSelected(null);
          }}
        >
          <div className="max-w-2xl mx-auto">
            <ExpenseForm
              onSuccess={handleFormSuccess}
              onCancel={() => {
                setShowEdit(false);
                setSelected(null);
              }}
              initialData={selected}
              expenseId={selected.id}
              isEdit
            />
          </div>
        </SlideModal>
      )}
      {showDetail && selected && (
        <ExpenseDetail
          expense={selected}
          onClose={() => {
            setShowDetail(false);
            setSelected(null);
          }}
          getCategoryLabel={getCategoryLabel}
        />
      )}

      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Expenses</h2>
            <p className="text-xs text-gray-400">{expenses.length} total</p>
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>

        {/* Search + controls */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search expenses…"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              className="pl-9 h-9"
            />
          </div>
          <Button
            variant={showFilters ? "default" : "outline"}
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={fetchExpenses}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Select
                  value={filters.status}
                  onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={filters.category}
                  onValueChange={(v) => setFilters((f) => ({ ...f, category: v }))}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={filters.priority}
                  onValueChange={(v) => setFilters((f) => ({ ...f, priority: v }))}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {hasActiveFilter && (
                <button
                  className="text-xs text-gray-400 hover:text-gray-600 underline"
                  onClick={() =>
                    setFilters({ status: "all", category: "all", priority: "all", search: "" })
                  }
                >
                  Reset filters
                </button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {fetchError && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {fetchError}
            <button className="ml-auto text-xs underline shrink-0" onClick={fetchExpenses}>
              Retry
            </button>
          </div>
        )}

        {/* Expense cards */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse h-24 bg-gray-100 rounded-xl" />
            ))}
          </div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-16">
            <IndianRupee className="h-10 w-10 mx-auto text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">
              {hasActiveFilter ? "No expenses match your filters" : "No expenses yet"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {expenses.map((expense) => {
              const StatusIcon = statusIcons[expense.status];
              const catColor = getCategoryColor(expense);
              return (
                <div key={expense.id} className="bg-white border rounded-xl overflow-hidden">
                  <div className="flex items-start gap-3 px-4 pt-3 pb-3">
                    {/* Category colour strip */}
                    <div
                      className="w-1 self-stretch rounded-full shrink-0 mt-0.5"
                      style={{ backgroundColor: catColor }}
                    />
                    <div className="flex-1 min-w-0">
                      {/* Title + amount */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-gray-900 truncate">
                            {expense.title}
                          </p>
                          {expense.vendor && (
                            <p className="text-xs text-gray-400 truncate">{expense.vendor}</p>
                          )}
                        </div>
                        <p className="font-bold text-sm text-gray-900 shrink-0">
                          {fmt(expense.amount)}
                        </p>
                      </div>

                      {/* Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <Badge
                          className={`text-xs flex items-center gap-1 ${statusColors[expense.status]}`}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {expense.status}
                        </Badge>
                        <Badge className={`text-xs ${priorityColors[expense.priority]}`}>
                          {expense.priority}
                        </Badge>
                        <span
                          className="text-xs px-1.5 py-0.5 rounded-full border font-medium"
                          style={{
                            color: catColor,
                            borderColor: `${catColor}40`,
                            backgroundColor: `${catColor}15`,
                          }}
                        >
                          {getCategoryLabel(expense)}
                        </span>
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1 text-xs text-gray-400 min-w-0">
                          <User className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            {expense.user_profiles?.full_name ||
                              expense.user_profiles?.email ||
                              "—"}
                          </span>
                          <span className="shrink-0 ml-1">· {fmtDate(expense.expense_date)}</span>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 -mr-1 shrink-0"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={() => {
                                setSelected(expense);
                                setShowDetail(true);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelected(expense);
                                setShowEdit(true);
                              }}
                            >
                              <Edit className="h-4 w-4 mr-2" />Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {expense.status === "pending" && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => handleStatusUpdate(expense.id, "approved")}
                                >
                                  <Check className="h-4 w-4 mr-2 text-green-600" />Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleStatusUpdate(
                                      expense.id,
                                      "rejected",
                                      "Manual rejection"
                                    )
                                  }
                                >
                                  <X className="h-4 w-4 mr-2 text-red-600" />Reject
                                </DropdownMenuItem>
                              </>
                            )}
                            {expense.status === "approved" && (
                              <DropdownMenuItem
                                onClick={() => handleStatusUpdate(expense.id, "paid")}
                              >
                                <IndianRupee className="h-4 w-4 mr-2" />Mark Paid
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleDelete(expense.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
