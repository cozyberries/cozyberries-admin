"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Check,
  X,
  DollarSign,
  Calendar,
  User,
  Building,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
} from "lucide-react";
import {
  Expense,
  ExpenseStatus,
  ExpenseCategory,
  ExpenseCategoryData,
  ExpensePriority,
} from "@/lib/types/expense";
import ExpenseForm from "./ExpenseForm";
import { useAuthenticatedFetch } from "@/hooks/useAuthenticatedFetch";
import { toast } from "sonner";
import { sendActivity } from "@/lib/utils/activities";

interface ExpenseManagementProps {}

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  paid: "bg-blue-100 text-blue-800",
  cancelled: "bg-gray-100 text-gray-800",
};

const statusIcons = {
  pending: Clock,
  approved: CheckCircle,
  rejected: XCircle,
  paid: DollarSign,
  cancelled: X,
};

const priorityColors = {
  low: "bg-gray-100 text-gray-800",
  medium: "bg-blue-100 text-blue-800",
  high: "bg-orange-100 text-orange-800",
  urgent: "bg-red-100 text-red-800",
};

// Dynamic category labels will be loaded from API

export default function ExpenseManagement({}: ExpenseManagementProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExpenses, setSelectedExpenses] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    status: "all",
    category: "all",
    priority: "all",
    search: "",
  });
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [categories, setCategories] = useState<ExpenseCategoryData[]>([]);

  const { fetch: authenticatedFetch } = useAuthenticatedFetch();

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (filters.status !== "all") params.append("status", filters.status);
      if (filters.category !== "all")
        params.append("category", filters.category);
      if (filters.priority !== "all")
        params.append("priority", filters.priority);
      if (filters.search) params.append("search", filters.search);

      const response = await authenticatedFetch(
        `/api/admin/expenses?${params}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch expenses");
      }

      const data = await response.json();
      setExpenses(data.expenses || []);
    } catch (error) {
      console.error("Error fetching expenses:", error);
      toast.error("Failed to load expenses");
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await authenticatedFetch(
        "/api/admin/expense-categories"
      );
      if (!response.ok) {
        throw new Error("Failed to fetch categories");
      }
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  useEffect(() => {
    fetchExpenses();
    fetchCategories();
  }, [filters]);

  const handleStatusUpdate = async (
    expenseId: string,
    status: ExpenseStatus,
    rejectedReason?: string
  ) => {
    try {
      const response = await authenticatedFetch(
        `/api/admin/expenses/${expenseId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status,
            ...(rejectedReason && { rejected_reason: rejectedReason }),
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update expense status");
      }

      const updatedExpense = await response.json();
      setExpenses((prev) =>
        prev.map((expense) =>
          expense.id === expenseId ? updatedExpense : expense
        )
      );

      toast.success(`Expense ${status} successfully`);
      await sendActivity(status === "approved" ? "expense_approved" : status === "rejected" ? 
        "expense_rejected" : status === "paid" ? "expense_marked_paid" 
        : "expense_cancelled", status === "approved" ? 
        `Expense ${updatedExpense.title} approved successfully` : status === "rejected" ? 
        `Expense ${updatedExpense.title} rejected successfully` : 
        status === "paid" ? `Expense ${updatedExpense.title} marked paid successfully` : 
        `Expense ${updatedExpense.title} cancelled successfully`, updatedExpense.title
      );
    } catch (error) {
      console.error("Error updating expense:", error);
      toast.error("Failed to update expense status");
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selectedExpenses.length === 0) {
      toast.error("Please select expenses to perform bulk actions");
      return;
    }

    try {
      const response = await authenticatedFetch("/api/admin/expenses/actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          expense_ids: selectedExpenses,
          ...(action === "reject" && { rejected_reason: "Bulk rejection" }),
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} expenses`);
      }

      const result = await response.json();
      toast.success(result.message);
      setSelectedExpenses([]);
      fetchExpenses();
    } catch (error) {
      console.error(`Error performing bulk ${action}:`, error);
      toast.error(`Failed to ${action} expenses`);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    try {
      const response = await authenticatedFetch(
        `/api/admin/expenses/${expenseId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete expense");
      }

      setExpenses((prev) => prev.filter((expense) => expense.id !== expenseId));
      toast.success("Expense deleted successfully");
      await sendActivity("expense_deleted", `Expense ${expenseId} deleted successfully`, expenseId);
    } catch (error) {
      console.error("Error deleting expense:", error);
      toast.error("Failed to delete expense");
    }
  };

  const toggleExpenseSelection = (expenseId: string) => {
    setSelectedExpenses((prev) =>
      prev.includes(expenseId)
        ? prev.filter((id) => id !== expenseId)
        : [...prev, expenseId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedExpenses.length === expenses.length) {
      setSelectedExpenses([]);
    } else {
      setSelectedExpenses(expenses.map((expense) => expense.id));
    }
  };

  const handleEditExpense = (expense: Expense) => {
    setSelectedExpense(expense);
    setShowEditDialog(true);
  };

  const handleFormSuccess = () => {
    setShowCreateDialog(false);
    setShowEditDialog(false);
    setSelectedExpense(null);
    fetchExpenses();
  };

  const getCategoryLabel = (expense: Expense) => {
    if (expense.category_data) {
      return expense.category_data.display_name;
    }
    // Fallback for legacy data
    const category = categories.find((cat) => cat.name === expense.category);
    return category?.display_name || expense.category;
  };

  const getCategoryColor = (expense: Expense) => {
    if (expense.category_data) {
      return expense.category_data.color;
    }
    // Fallback for legacy data
    const category = categories.find((cat) => cat.name === expense.category);
    return category?.color || "#6B7280";
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Expense Management</h1>
          <p className="text-gray-600">Manage and track company expenses</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Expense
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="mr-2 h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search expenses..."
                value={filters.search}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, search: e.target.value }))
                }
                className="pl-10"
              />
            </div>
            <Select
              value={filters.status}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, status: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
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
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, category: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.name}>
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <span>{category.display_name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.priority}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, priority: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by priority" />
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
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedExpenses.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {selectedExpenses.length} expense(s) selected
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkAction("approve")}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkAction("reject")}
                >
                  <X className="mr-2 h-4 w-4" />
                  Reject
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkAction("mark_paid")}
                >
                  <DollarSign className="mr-2 h-4 w-4" />
                  Mark Paid
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expenses Table */}
      <Card>
        <CardHeader>
          <CardTitle>Expenses</CardTitle>
          <CardDescription>{expenses.length} total expenses</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        selectedExpenses.length === expenses.length &&
                        expenses.length > 0
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => {
                  const StatusIcon = statusIcons[expense.status];
                  return (
                    <TableRow key={expense.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedExpenses.includes(expense.id)}
                          onCheckedChange={() =>
                            toggleExpenseSelection(expense.id)
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div>
                          <div className="font-semibold">{expense.title}</div>
                          {expense.vendor && (
                            <div className="text-sm text-gray-500">
                              {expense.vendor}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatCurrency(expense.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          style={{
                            backgroundColor: `${getCategoryColor(expense)}20`,
                            color: getCategoryColor(expense),
                            borderColor: getCategoryColor(expense),
                          }}
                        >
                          {getCategoryLabel(expense)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={priorityColors[expense.priority]}>
                          {expense.priority.charAt(0).toUpperCase() +
                            expense.priority.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[expense.status]}>
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {expense.status.charAt(0).toUpperCase() +
                            expense.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(expense.expense_date)}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <User className="mr-1 h-3 w-3" />
                          {expense.user_profiles?.full_name || expense.user_profiles?.email}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedExpense(expense);
                                setShowDetailsDialog(true);
                              }}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleEditExpense(expense)}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Expense
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {expense.status === "pending" && (
                              <>
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleStatusUpdate(expense.id, "approved")
                                  }
                                >
                                  <Check className="mr-2 h-4 w-4" />
                                  Approve
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
                                  <X className="mr-2 h-4 w-4" />
                                  Reject
                                </DropdownMenuItem>
                              </>
                            )}
                            {expense.status === "approved" && (
                              <DropdownMenuItem
                                onClick={() =>
                                  handleStatusUpdate(expense.id, "paid")
                                }
                              >
                                <DollarSign className="mr-2 h-4 w-4" />
                                Mark as Paid
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteExpense(expense.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Expense Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Expense Details</DialogTitle>
            <DialogDescription>
              View detailed information about this expense
            </DialogDescription>
          </DialogHeader>
          {selectedExpense && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Title
                  </label>
                  <p className="text-lg font-semibold">
                    {selectedExpense.title}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Amount
                  </label>
                  <p className="text-lg font-semibold">
                    {formatCurrency(selectedExpense.amount)}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Category
                  </label>
                  <p>{getCategoryLabel(selectedExpense)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Priority
                  </label>
                  <Badge className={priorityColors[selectedExpense.priority]}>
                    {selectedExpense.priority.charAt(0).toUpperCase() +
                      selectedExpense.priority.slice(1)}
                  </Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Status
                  </label>
                  <Badge className={statusColors[selectedExpense.status]}>
                    {selectedExpense.status.charAt(0).toUpperCase() +
                      selectedExpense.status.slice(1)}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Expense Date
                  </label>
                  <p>{formatDate(selectedExpense.expense_date)}</p>
                </div>
              </div>
              {selectedExpense.vendor && (
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Vendor
                  </label>
                  <p>{selectedExpense.vendor}</p>
                </div>
              )}
              {selectedExpense.description && (
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Description
                  </label>
                  <p>{selectedExpense.description}</p>
                </div>
              )}
              {selectedExpense.notes && (
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Notes
                  </label>
                  <p>{selectedExpense.notes}</p>
                </div>
              )}
              {selectedExpense.rejected_reason && (
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Rejection Reason
                  </label>
                  <p className="text-red-600">
                    {selectedExpense.rejected_reason}
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Submitted By
                  </label>
                  <p>
                    {selectedExpense.user_profiles?.full_name ||
                      selectedExpense.user_profiles?.email}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Created At
                  </label>
                  <p>{formatDate(selectedExpense.created_at)}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Expense Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Expense</DialogTitle>
            <DialogDescription>
              Add a new expense entry to the system.
            </DialogDescription>
          </DialogHeader>
          <ExpenseForm
            onSuccess={handleFormSuccess}
            onCancel={() => setShowCreateDialog(false)}
            isEdit={false}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Expense Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
            <DialogDescription>
              Update the expense information.
            </DialogDescription>
          </DialogHeader>
          {selectedExpense && (
            <ExpenseForm
              onSuccess={handleFormSuccess}
              onCancel={() => setShowEditDialog(false)}
              initialData={selectedExpense}
              expenseId={selectedExpense.id}
              isEdit={true}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
