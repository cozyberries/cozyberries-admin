"use client";

import { useState, useEffect } from "react";
import {
  Search,
  Calendar,
  Package,
  MoreHorizontal,
  Eye,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  CalendarDays,
  Plus,
  CreditCard,
  Edit,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Order, OrderStatus, Payment, PaymentStatus } from "@/lib/types/order";
import { useAuthenticatedFetch } from "@/hooks/useAuthenticatedFetch";
import OrderForm from "./OrderForm";
import { toast } from "sonner";

interface OrderWithPayments extends Order {
  payments?: Payment[];
}

export default function OrderManagement() {
  const [orders, setOrders] = useState<OrderWithPayments[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [showForm, setShowForm] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [updatingPaymentId, setUpdatingPaymentId] = useState<string | null>(null);

  // Date filter states - default to last 1 week
  const getOneWeekAgo = () => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split("T")[0];
  };

  const [fromDate, setFromDate] = useState<string>(getOneWeekAgo());
  const [toDate, setToDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  const { get, put, patch, delete: del } = useAuthenticatedFetch();

  useEffect(() => {
    fetchOrders();
  }, [fromDate, toDate, statusFilter]);

  const fetchOrders = async () => {
    try {
      setLoading(true);

      // Build query parameters
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }
      if (fromDate) {
        params.append("from_date", fromDate);
      }
      if (toDate) {
        params.append("to_date", toDate);
      }

      const queryString = params.toString();
      const url = `/api/admin/orders${queryString ? `?${queryString}` : ""}`;

      const response = await get(url, { requireAdmin: true });
      const data = await response.json();
      setOrders(data.orders || []);
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (
    orderId: string,
    newStatus: OrderStatus
  ) => {
    try {
      const response = await put(
        `/api/admin/orders/${orderId}`,
        { status: newStatus },
        { requireAdmin: true }
      );

      if (response.ok) {
        setOrders(
          orders.map((order) =>
            order.id === orderId ? { ...order, status: newStatus } : order
          )
        );
      } else {
        toast.error("Failed to update order status");
      }
    } catch (error) {
      console.error("Error updating order status:", error);
      toast.error("Error updating order status");
    }
  };

  const handlePaymentStatusUpdate = async (
    paymentId: string,
    newStatus: PaymentStatus,
    orderId: string
  ) => {
    setUpdatingPaymentId(paymentId);
    try {
      const response = await patch(
        `/api/admin/payments/${paymentId}`,
        { status: newStatus },
        { requireAdmin: true }
      );

      if (response.ok) {
        // Update the payment in the orders state
        setOrders(
          orders.map((order) => {
            if (order.id === orderId && order.payments) {
              return {
                ...order,
                payments: order.payments.map((payment) =>
                  payment.id === paymentId
                    ? { ...payment, status: newStatus }
                    : payment
                ),
              };
            }
            return order;
          })
        );
        setEditingPaymentId(null);
        toast.success("Payment status updated successfully");
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.error || "Failed to update payment status");
      }
    } catch (error) {
      console.error("Error updating payment status:", error);
      toast.error("Error updating payment status");
    } finally {
      setUpdatingPaymentId(null);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this order? This action cannot be undone."
      )
    )
      return;

    try {
      const response = await del(`/api/admin/orders/${orderId}`, {
        requireAdmin: true,
      });

      if (response.ok) {
        setOrders(orders.filter((order) => order.id !== orderId));
        toast.success("Order deleted successfully");
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.error || "Failed to delete order");
      }
    } catch (error) {
      console.error("Error deleting order:", error);
      toast.error("Error deleting order");
    }
  };

  const getPaymentStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case "pending":
        return "bg-orange-100 text-orange-800";
      case "processing":
        return "bg-blue-100 text-blue-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "cancelled":
        return "bg-gray-100 text-gray-800";
      case "refunded":
        return "bg-gray-100 text-gray-800";
      case "partially_refunded":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatPaymentStatus = (status: PaymentStatus) => {
    return status
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const isOfflineOrder = (payment: Payment) => {
    return (
      payment.gateway_provider === "manual" ||
      payment.payment_method === "cod" ||
      payment.payment_method === "bank_transfer"
    );
  };

  const getStatusIcon = (status: OrderStatus) => {
    switch (status) {
      case "payment_pending":
        return <Clock className="h-4 w-4" />;
      case "payment_confirmed":
        return <CheckCircle className="h-4 w-4" />;
      case "processing":
        return <Package className="h-4 w-4" />;
      case "shipped":
        return <Truck className="h-4 w-4" />;
      case "delivered":
        return <CheckCircle className="h-4 w-4" />;
      case "cancelled":
        return <XCircle className="h-4 w-4" />;
      case "refunded":
        return <XCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case "payment_pending":
        return "bg-yellow-100 text-yellow-800";
      case "payment_confirmed":
        return "bg-blue-100 text-blue-800";
      case "processing":
        return "bg-purple-100 text-purple-800";
      case "shipped":
        return "bg-indigo-100 text-indigo-800";
      case "delivered":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      case "refunded":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.shipping_address.full_name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || order.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const statusOptions: { value: OrderStatus | "all"; label: string }[] = [
    { value: "all", label: "All Orders" },
    { value: "payment_pending", label: "Payment Pending" },
    { value: "payment_confirmed", label: "Payment Confirmed" },
    { value: "processing", label: "Processing" },
    { value: "shipped", label: "Shipped" },
    { value: "delivered", label: "Delivered" },
    { value: "cancelled", label: "Cancelled" },
    { value: "refunded", label: "Refunded" },
  ];

  const handleFormSubmit = () => {
    setShowForm(false);
    fetchOrders();
  };

  if (showForm) {
    return (
      <OrderForm
        onSuccess={handleFormSubmit}
        onCancel={() => {
          setShowForm(false);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Order Management</h1>
        <p className="text-gray-600 mt-1">Manage and track customer orders</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Date Filters */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">
                  Date Range:
                </span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 items-center">
                <div className="flex items-center gap-2">
                  <label htmlFor="from-date" className="text-sm text-gray-600">
                    From:
                  </label>
                  <Input
                    id="from-date"
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-auto"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="to-date" className="text-sm text-gray-600">
                    To:
                  </label>
                  <Input
                    id="to-date"
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-auto"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFromDate(getOneWeekAgo());
                    setToDate(new Date().toISOString().split("T")[0]);
                  }}
                >
                  Last Week
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const oneMonthAgo = new Date();
                    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
                    setFromDate(oneMonthAgo.toISOString().split("T")[0]);
                    setToDate(new Date().toISOString().split("T")[0]);
                  }}
                >
                  Last Month
                </Button>
              </div>
              <Button onClick={() => setShowForm(true)} className="flex items-center">
                <Plus className="h-4 w-4 mr-2" />
                Add Order
              </Button>
            </div>

            {/* Status Filters */}
            <div className="flex gap-2 flex-wrap">
              {statusOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={
                    statusFilter === option.value ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() => setStatusFilter(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Orders ({filteredOrders.length})</CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                {fromDate && toDate ? (
                  <>
                    Showing orders from{" "}
                    {new Date(fromDate).toLocaleDateString()} to{" "}
                    {new Date(toDate).toLocaleDateString()}
                  </>
                ) : fromDate ? (
                  <>
                    Showing orders from{" "}
                    {new Date(fromDate).toLocaleDateString()}
                  </>
                ) : toDate ? (
                  <>
                    Showing orders up to {new Date(toDate).toLocaleDateString()}
                  </>
                ) : (
                  <>Showing all orders</>
                )}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFromDate(getOneWeekAgo());
                setToDate(new Date().toISOString().split("T")[0]);
                setStatusFilter("all");
                setSearchTerm("");
              }}
            >
              Reset to Default
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-20 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="border rounded-lg p-4 hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4 mb-2">
                        <h3 className="font-semibold text-lg">
                          Order #{order.order_number || order.id.slice(0, 8)}
                        </h3>
                        <Badge className={getStatusColor(order.status)}>
                          <span className="flex items-center">
                            {getStatusIcon(order.status)}
                            <span className="ml-1 capitalize">
                              {order.status.replace("_", " ")}
                            </span>
                          </span>
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                        <div>
                          <p>
                            <strong>Customer:</strong> {order.customer_email}
                          </p>
                          <p>
                            <strong>Name:</strong>{" "}
                            {order.shipping_address.full_name}
                          </p>
                        </div>
                        <div>
                          <p>
                            <strong>Items:</strong> {order.items.length} items
                          </p>
                          <p>
                            <strong>Total:</strong>{" "}
                            {formatCurrency(order.total_amount)}
                          </p>
                        </div>
                        <div>
                          <p>
                            <strong>Ordered:</strong>{" "}
                            {formatDate(order.created_at)}
                          </p>
                          <p>
                            <strong>Location:</strong>{" "}
                            {order.shipping_address.city},{" "}
                            {order.shipping_address.state}
                          </p>
                        </div>
                      </div>

                      {/* Payment Information */}
                      {order.payments && order.payments.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <div className="flex items-center gap-2 mb-2">
                            <CreditCard className="h-4 w-4 text-gray-500" />
                            <h4 className="text-sm font-semibold text-gray-700">
                              Payment Information
                            </h4>
                          </div>
                          <div className="space-y-2">
                            {order.payments.map((payment) => (
                              <div
                                key={payment.id}
                                className={`flex items-center justify-between p-2 bg-gray-50 rounded-md ${updatingPaymentId === payment.id
                                    ? "opacity-75"
                                    : ""
                                  }`}
                              >
                                <div className="flex items-center gap-3 flex-1">
                                  <Badge
                                    className={getPaymentStatusColor(
                                      payment.status
                                    )}
                                  >
                                    {updatingPaymentId === payment.id ? (
                                      <div className="flex items-center gap-1">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        <span>{formatPaymentStatus(payment.status)}</span>
                                      </div>
                                    ) : (
                                      formatPaymentStatus(payment.status)
                                    )}
                                  </Badge>
                                  <span className="text-xs text-gray-600">
                                    {payment.payment_method
                                      .replace("_", " ")
                                      .toUpperCase()}
                                  </span>
                                  {isOfflineOrder(payment) && (
                                    <Badge variant="outline" className="text-xs">
                                      Offline
                                    </Badge>
                                  )}
                                  <span className="text-sm font-medium">
                                    {formatCurrency(payment.amount)}
                                  </span>
                                </div>
                                {editingPaymentId === payment.id ? (
                                  <div className="flex items-center gap-2">
                                    <Select
                                      value={payment.status}
                                      onValueChange={(value) =>
                                        handlePaymentStatusUpdate(
                                          payment.id,
                                          value as PaymentStatus,
                                          order.id
                                        )
                                      }
                                      disabled={updatingPaymentId === payment.id}
                                    >
                                      <SelectTrigger className="w-40 h-8">
                                        {updatingPaymentId === payment.id ? (
                                          <div className="flex items-center gap-2">
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            <span>Updating...</span>
                                          </div>
                                        ) : (
                                          <SelectValue />
                                        )}
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="pending">
                                          Pending
                                        </SelectItem>
                                        <SelectItem value="processing">
                                          Processing
                                        </SelectItem>
                                        <SelectItem value="completed">
                                          Completed
                                        </SelectItem>
                                        <SelectItem value="failed">
                                          Failed
                                        </SelectItem>
                                        <SelectItem value="cancelled">
                                          Cancelled
                                        </SelectItem>
                                        <SelectItem value="refunded">
                                          Refunded
                                        </SelectItem>
                                        <SelectItem value="partially_refunded">
                                          Partially Refunded
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setEditingPaymentId(null)}
                                      disabled={updatingPaymentId === payment.id}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      setEditingPaymentId(payment.id)
                                    }
                                    className="h-8"
                                    disabled={updatingPaymentId === payment.id}
                                  >
                                    {updatingPaymentId === payment.id ? (
                                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    ) : (
                                      <Edit className="h-3 w-3 mr-1" />
                                    )}
                                    {updatingPaymentId === payment.id
                                      ? "Updating..."
                                      : "Edit"}
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          {order.status === "payment_pending" && (
                            <DropdownMenuItem
                              onClick={() =>
                                handleStatusUpdate(order.id, "payment_confirmed")
                              }
                            >
                              <Package className="h-4 w-4 mr-2" />
                              Mark as Payment Confirmed
                            </DropdownMenuItem>
                          )}
                          {order.status === "payment_confirmed" && (
                            <DropdownMenuItem
                              onClick={() =>
                                handleStatusUpdate(order.id, "processing")
                              }
                            >
                              <Package className="h-4 w-4 mr-2" />
                              Mark as Processing
                            </DropdownMenuItem>
                          )}
                          {order.status === "processing" && (
                            <DropdownMenuItem
                              onClick={() =>
                                handleStatusUpdate(order.id, "shipped")
                              }
                            >
                              <Truck className="h-4 w-4 mr-2" />
                              Mark as Shipped
                            </DropdownMenuItem>
                          )}
                          {order.status === "shipped" && (
                            <DropdownMenuItem
                              onClick={() =>
                                handleStatusUpdate(order.id, "delivered")
                              }
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Mark as Delivered
                            </DropdownMenuItem>
                          )}
                          {(order.status === "payment_pending" ||
                            order.status === "processing") && (
                              <DropdownMenuItem
                                onClick={() =>
                                  handleStatusUpdate(order.id, "cancelled")
                                }
                                className="text-red-600"
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Cancel Order
                              </DropdownMenuItem>
                            )}
                          {(order.status === "cancelled" ||
                            order.status === "refunded") && (
                              <DropdownMenuItem
                                onClick={() => handleDeleteOrder(order.id)}
                                className="text-red-600"
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Delete Order
                              </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && filteredOrders.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <Package className="h-12 w-12 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No orders found
              </h3>
              <p className="text-gray-500">
                {searchTerm || statusFilter !== "all"
                  ? "Try adjusting your search or filter criteria"
                  : "No orders have been placed yet"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
