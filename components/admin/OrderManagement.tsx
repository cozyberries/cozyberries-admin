"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search,
  Package,
  MoreHorizontal,
  Eye,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  Plus,
  CreditCard,
  Loader2,
  AlertCircle,
  X,
  MapPin,
  RefreshCw,
  SlidersHorizontal,
  Banknote,
  Pencil,
  Download,
  Send,
  Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
import { isDelhiveryOrder } from "@/lib/delhivery";
import DelhiveryTrackingPanel from "@/components/admin/DelhiveryTrackingPanel";

interface OrderWithPayments extends Order {
  payments?: Payment[];
}

// ── Shared helpers ────────────────────────────────────────────────────────────
const fmt = (amount: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);

const statusColor: Record<OrderStatus, string> = {
  payment_pending: "bg-yellow-100 text-yellow-800",
  payment_confirmed: "bg-blue-100 text-blue-800",
  processing: "bg-purple-100 text-purple-800",
  shipped: "bg-indigo-100 text-indigo-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  refunded: "bg-gray-100 text-gray-800",
};

// ── Ship Order Dialog ────────────────────────────────────────────────────────
function ShipOrderDialog({
  order,
  onClose,
  onShipped,
}: {
  order: OrderWithPayments;
  onClose: () => void;
  onShipped: (orderId: string, data: Record<string, string>) => Promise<void>;
}) {
  const [trackingNumber, setTrackingNumber] = useState(order.tracking_number || "");
  const [carrierName, setCarrierName] = useState(order.carrier_name || "");
  const [estimatedDelivery, setEstimatedDelivery] = useState(
    order.estimated_delivery_date ? order.estimated_delivery_date.split("T")[0] : ""
  );
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSubmitError(null);
    try {
      await onShipped(order.id, {
        status: "shipped",
        tracking_number: trackingNumber,
        carrier_name: carrierName,
        estimated_delivery_date: estimatedDelivery
          ? new Date(estimatedDelivery).toISOString()
          : "",
      });
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to ship order");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-md sm:rounded-lg shadow-xl">
        <div className="flex items-center justify-between px-4 py-4 border-b">
          <h2 className="text-base font-semibold">Mark as Shipped</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
          <div>
            <Label htmlFor="tracking">Tracking Number</Label>
            <Input id="tracking" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="e.g. BD123456789IN" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="carrier">Carrier / Courier</Label>
            <Input id="carrier" value={carrierName} onChange={(e) => setCarrierName(e.target.value)} placeholder="e.g. Delhivery, Blue Dart, DTDC" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="eta">Estimated Delivery Date</Label>
            <Input id="eta" type="date" value={estimatedDelivery} onChange={(e) => setEstimatedDelivery(e.target.value)} className="mt-1" />
          </div>
          {submitError && <p className="text-red-500 text-sm">{submitError}</p>}
          <div className="flex gap-2 pt-1 pb-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1" disabled={saving}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Truck className="h-4 w-4 mr-2" />}
              Confirm
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Order Detail Modal ───────────────────────────────────────────────────────
function OrderDetailModal({
  order,
  onClose,
  onStatusChange,
  onUpdateTracking,
  onCreateDelhivery,
  onCancelDelhivery,
  onDownloadLabel,
  delhiveryBusy,
}: {
  order: OrderWithPayments;
  onClose: () => void;
  onStatusChange: (orderId: string, status: OrderStatus) => Promise<void>;
  onUpdateTracking: (orderId: string, data: Record<string, string>) => Promise<void>;
  onCreateDelhivery?: (orderId: string) => Promise<void>;
  onCancelDelhivery?: (orderId: string) => void;
  onDownloadLabel?: (orderId: string, orderNumber?: string) => void;
  delhiveryBusy?: boolean;
}) {
  const [editingTracking, setEditingTracking] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState(order.tracking_number || "");
  const [carrierName, setCarrierName] = useState(order.carrier_name || "");
  const [estimatedDelivery, setEstimatedDelivery] = useState(
    order.estimated_delivery_date ? order.estimated_delivery_date.split("T")[0] : ""
  );
  const [actualDelivery, setActualDelivery] = useState(
    order.actual_delivery_date ? order.actual_delivery_date.split("T")[0] : ""
  );
  const [deliveryNotes, setDeliveryNotes] = useState(order.delivery_notes || "");
  const [savingTracking, setSavingTracking] = useState(false);
  const [editingStatus, setEditingStatus] = useState(false);

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  const statusIcon: Record<OrderStatus, React.ReactNode> = {
    payment_pending: <Clock className="h-3 w-3" />,
    payment_confirmed: <Banknote className="h-3 w-3" />,
    processing: <Package className="h-3 w-3" />,
    shipped: <Truck className="h-3 w-3" />,
    delivered: <CheckCircle className="h-3 w-3" />,
    cancelled: <XCircle className="h-3 w-3" />,
    refunded: <XCircle className="h-3 w-3" />,
  };

  const paymentColor: Record<PaymentStatus, string> = {
    pending: "bg-orange-100 text-orange-800",
    processing: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
    cancelled: "bg-gray-100 text-gray-800",
    refunded: "bg-gray-100 text-gray-800",
    partially_refunded: "bg-yellow-100 text-yellow-800",
  };

  const handleSaveTracking = async () => {
    setSavingTracking(true);
    try {
      await onUpdateTracking(order.id, {
        tracking_number: trackingNumber,
        carrier_name: carrierName,
        estimated_delivery_date: estimatedDelivery ? new Date(estimatedDelivery).toISOString() : "",
        actual_delivery_date: actualDelivery ? new Date(actualDelivery).toISOString() : "",
        delivery_notes: deliveryNotes,
      });
      setEditingTracking(false);
    } finally {
      setSavingTracking(false);
    }
  };

  const ALL_STATUSES: OrderStatus[] = [
    "payment_pending", "payment_confirmed", "processing",
    "shipped", "delivered", "cancelled", "refunded",
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full max-w-2xl h-full sm:h-auto sm:max-h-[90vh] sm:rounded-lg shadow-xl flex flex-col">
        {/* Header — mobile-first: compact, order number doesn't wrap awkwardly */}
        <div className="px-4 py-3 border-b shrink-0">
          <div className="flex items-center justify-between gap-3 min-w-0">
            <h2 className="text-base font-semibold truncate min-w-0" title={order.order_number || order.id}>
              Order #{order.order_number || order.id}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 shrink-0 -mr-1 touch-manipulation" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <p className="text-xs text-gray-500">{fmtDate(order.created_at)}</p>
            {editingStatus ? (
              <Select
                value={order.status}
                onValueChange={async (v) => {
                  await onStatusChange(order.id, v as OrderStatus);
                  setEditingStatus(false);
                }}
              >
                <SelectTrigger className="h-7 text-xs w-48 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center gap-1">
                <Badge className={`text-xs flex items-center gap-1 ${statusColor[order.status]}`}>
                  {statusIcon[order.status]}
                  {order.status.replace(/_/g, " ")}
                </Badge>
                <button
                  onClick={() => setEditingStatus(true)}
                  className="text-gray-400 hover:text-gray-600 p-0.5"
                  title="Change status"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Body — scrollable; extra padding at bottom so summary + Total stay above nav */}
        <div className="overflow-y-auto flex-1 px-4 py-4 pb-24 space-y-5">
          {/* Customer + Address */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Customer</p>
              <p className="text-sm font-medium">{order.shipping_address?.full_name}</p>
              <p className="text-sm text-gray-500 break-all">{order.customer_email}</p>
              {order.customer_phone && <p className="text-sm text-gray-500">{order.customer_phone}</p>}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Shipping
              </p>
              <div className="text-sm text-gray-700 space-y-0.5">
                <p>{order.shipping_address?.address_line_1}</p>
                {order.shipping_address?.address_line_2 && <p>{order.shipping_address.address_line_2}</p>}
                <p>{order.shipping_address?.city}, {order.shipping_address?.state} {order.shipping_address?.postal_code}</p>
                {order.shipping_address?.phone && <p className="text-gray-500">{order.shipping_address.phone}</p>}
              </div>
            </div>
          </div>

          {/* Tracking */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                <Truck className="h-3 w-3" /> Tracking
              </p>
              {!editingTracking && (
                <button onClick={() => setEditingTracking(true)} className="text-xs text-blue-600 hover:underline">Edit</button>
              )}
            </div>
            {editingTracking ? (
              <div className="space-y-2 bg-gray-50 rounded-lg p-3">
                <Input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="Tracking number" className="h-9 text-sm" />
                <Input value={carrierName} onChange={(e) => setCarrierName(e.target.value)} placeholder="Carrier (e.g. Delhivery)" className="h-9 text-sm" />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Est. Delivery</p>
                    <Input type="date" value={estimatedDelivery} onChange={(e) => setEstimatedDelivery(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Actual Delivery</p>
                    <Input type="date" value={actualDelivery} onChange={(e) => setActualDelivery(e.target.value)} className="h-9 text-sm" />
                  </div>
                </div>
                <Input value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)} placeholder="Delivery notes (optional)" className="h-9 text-sm" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveTracking} disabled={savingTracking} className="flex-1">
                    {savingTracking && <Loader2 className="h-3 w-3 animate-spin mr-1" />}Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingTracking(false)} disabled={savingTracking} className="flex-1">Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-700 space-y-0.5">
                {order.tracking_number && (
                  <p><span className="text-gray-400">Tracking #:</span> <span className="font-mono font-medium">{order.tracking_number}</span></p>
                )}
                {order.carrier_name && <p><span className="text-gray-400">Carrier:</span> {order.carrier_name}</p>}
                {order.estimated_delivery_date && (
                  <p><span className="text-gray-400">ETA:</span> {new Date(order.estimated_delivery_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-")}</p>
                )}
                {order.actual_delivery_date && (
                  <p><span className="text-gray-400">Delivered:</span> {new Date(order.actual_delivery_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-")}</p>
                )}
                {order.delivery_notes && (
                  <p><span className="text-gray-400">Notes:</span> {order.delivery_notes}</p>
                )}
                {!order.tracking_number && !order.estimated_delivery_date && !order.actual_delivery_date && !order.delivery_notes && (
                  <p className="text-gray-400 italic">No tracking info yet</p>
                )}
              </div>
            )}

            {/* Delhivery actions */}
            <div className="flex flex-wrap gap-2 mt-2">
              {order.tracking_number && order.carrier_name === "Delhivery" ? (
                <>
                  {onDownloadLabel && !["cancelled", "delivered", "refunded"].includes(order.status) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDownloadLabel(order.id, order.order_number)}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Print Label
                    </Button>
                  )}
                  {onCancelDelhivery && !["cancelled", "delivered", "refunded"].includes(order.status) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => onCancelDelhivery(order.id)}
                      disabled={delhiveryBusy}
                    >
                      <Ban className="h-3 w-3 mr-1" />Cancel Shipment
                    </Button>
                  )}
                </>
              ) : (
                <>
                  {onCreateDelhivery && ["payment_confirmed", "processing"].includes(order.status) && (
                    <Button
                      size="sm"
                      onClick={() => onCreateDelhivery(order.id)}
                      disabled={delhiveryBusy}
                    >
                      {delhiveryBusy ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                      Create Delhivery Shipment
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Delhivery live tracking */}
          {isDelhiveryOrder(order.carrier_name, order.tracking_number, order.status) && (
            <DelhiveryTrackingPanel order={order} />
          )}
          {/* "Add tracking number" nudge — shown when carrier is Delhivery but no AWB set */}
          {order.carrier_name?.toLowerCase().includes("delhivery") &&
            !order.tracking_number && (
            <p className="text-xs text-gray-400 italic">
              Add a tracking number to fetch Delhivery scans.
            </p>
          )}

          {/* Items */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Items</p>
            <div className="divide-y border rounded-lg overflow-hidden">
              {(order.items ?? []).map((item, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 bg-white">
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image} alt={item.name} className="w-9 h-9 rounded object-cover shrink-0" />
                  ) : (
                    <div className="w-9 h-9 bg-gray-100 rounded flex items-center justify-center shrink-0">
                      <Package className="h-4 w-4 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-gray-500 uppercase">
                      Size: {item.size ?? item.product_details?.size ?? "—"} · Color: {item.color ?? item.product_details?.color ?? "—"}
                    </p>
                    <p className="text-xs text-gray-500">Qty {item.quantity} × {fmt(item.price)}</p>
                  </div>
                  <p className="text-sm font-semibold shrink-0">{fmt(item.price * item.quantity)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Summary — Total emphasized and always visible above bottom nav */}
          <div className="bg-gray-50 rounded-lg px-4 py-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{fmt(order.subtotal)}</span></div>
            <div className="flex justify-between text-gray-500"><span>Delivery</span><span>{fmt(order.delivery_charge)}</span></div>
            {order.tax_amount > 0 && <div className="flex justify-between text-gray-500"><span>Tax</span><span>{fmt(order.tax_amount)}</span></div>}
            <div className="flex justify-between items-baseline border-t border-gray-200 pt-3 mt-2">
              <span className="font-semibold text-foreground">Total</span>
              <span className="text-lg font-bold text-foreground">{fmt(order.total_amount)}</span>
            </div>
          </div>

          {/* Payments */}
          {order.payments && order.payments.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                <CreditCard className="h-3 w-3" /> Payments
              </p>
              <div className="space-y-2">
                {order.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 border rounded-lg gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge className={`text-xs ${paymentColor[p.status]}`}>{p.status.replace(/_/g, " ")}</Badge>
                      <span className="text-xs text-gray-500">{p.payment_method.replace(/_/g, " ").toUpperCase()}</span>
                      {p.gateway_provider === "manual" && <Badge variant="outline" className="text-xs">Offline</Badge>}
                    </div>
                    <span className="text-sm font-semibold shrink-0">{fmt(p.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {order.notes && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm text-gray-600">{order.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Confirmation Modal ────────────────────────────────────────────────────────
function ConfirmationModal({
  title,
  message,
  confirmLabel = "Confirm",
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const cancelCallbackRef = useRef(onCancel);
  useEffect(() => { cancelCallbackRef.current = onCancel; }, [onCancel]);

  useEffect(() => {
    cancelRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelCallbackRef.current();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="bg-white w-full max-w-sm mx-4 rounded-lg shadow-xl p-6">
        <h2 id="confirm-modal-title" className="text-base font-semibold mb-2">{title}</h2>
        <p className="text-sm text-gray-600 mb-6">{message}</p>
        <div className="flex gap-3">
          <Button ref={cancelRef} variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button onClick={onConfirm} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Date preset helpers ───────────────────────────────────────────────────────
type DatePreset = "7d" | "30d" | "90d" | "180d" | "all" | "custom";

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: "7d",   label: "Last Week" },
  { key: "30d",  label: "Last Month" },
  { key: "90d",  label: "3 Months" },
  { key: "180d", label: "6 Months" },
  { key: "all",  label: "All Time" },
  { key: "custom", label: "Custom" },
];

const todayStr = () => new Date().toISOString().split("T")[0];

const daysAgoStr = (n: number) => {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split("T")[0];
};

const monthsAgoStr = (n: number) => {
  const d = new Date(); d.setMonth(d.getMonth() - n); return d.toISOString().split("T")[0];
};

const presetToDates = (preset: DatePreset): { from: string; to: string } => {
  const t = todayStr();
  switch (preset) {
    case "7d":   return { from: daysAgoStr(7),    to: t };
    case "30d":  return { from: daysAgoStr(30),   to: t };
    case "90d":  return { from: monthsAgoStr(3),  to: t };
    case "180d": return { from: monthsAgoStr(6),  to: t };
    case "all":  return { from: "",               to: "" };
    default:     return { from: daysAgoStr(7),    to: t };
  }
};

// ── Main Component ───────────────────────────────────────────────────────────
export default function OrderManagement() {
  const [orders, setOrders] = useState<OrderWithPayments[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get("search") ?? "");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [showForm, setShowForm] = useState(false);
  const [shipOrder, setShipOrder] = useState<OrderWithPayments | null>(null);
  const [detailOrder, setDetailOrder] = useState<OrderWithPayments | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const [datePreset, setDatePreset] = useState<DatePreset>("7d");
  const [fromDate, setFromDate] = useState<string>(daysAgoStr(7));
  const [toDate, setToDate] = useState<string>(todayStr());
  const [userFilter, setUserFilter] = useState<string>("");
  const [users, setUsers] = useState<{ id: string; email?: string; full_name?: string }[]>([]);

  const { get, post, patch, put, delete: del } = useAuthenticatedFetch();

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (fromDate) params.append("from_date", fromDate);
      if (toDate) params.append("to_date", toDate);
      const url = `/api/orders${params.toString() ? `?${params}` : ""}`;
      const response = await get(url, { requireAdmin: true });
      const data = await response.json();
      setOrders(data.orders || []);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to fetch orders");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, fromDate, toDate, get]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Fetch users once when the filter panel opens
  useEffect(() => {
    if (!showFilters || users.length > 0) return;
    get("/api/users", { requireAdmin: true })
      .then((res) => res.json())
      .then((data) => setUsers(data.users || []))
      .catch(() => {/* silently ignore */});
  }, [showFilters, users.length, get]);

  const handleStatusUpdate = async (orderId: string, newStatus: OrderStatus) => {
    try {
      await put(`/api/orders/${orderId}`, { status: newStatus }, { requireAdmin: true });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));
      setDetailOrder((prev) => (prev?.id === orderId ? { ...prev, status: newStatus } : prev));
      toast.success(`Marked as ${newStatus.replace(/_/g, " ")}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const handleUpdateTracking = async (orderId: string, data: Record<string, string>) => {
    try {
      await put(`/api/orders/${orderId}`, data, { requireAdmin: true });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...data } : o)));
      setDetailOrder((prev) => (prev?.id === orderId ? { ...prev, ...data } : prev));
      toast.success("Tracking updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update tracking");
      throw err;
    }
  };

  const handleShipOrder = async (orderId: string, data: Record<string, string>) => {
    try {
      await put(`/api/orders/${orderId}`, data, { requireAdmin: true });
      const updates = { ...data, status: "shipped" as OrderStatus };
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...updates } : o)));
      setDetailOrder((prev) => (prev?.id === orderId ? { ...prev, ...updates } : prev));
      toast.success("Marked as shipped");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to ship order");
      throw err;
    }
  };


  const handleDeleteOrder = (orderId: string) => {
    setPendingDeleteId(orderId);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteId) return;
    try {
      await del(`/api/orders/${pendingDeleteId}`, { requireAdmin: true });
      setOrders((prev) => prev.filter((o) => o.id !== pendingDeleteId));
      if (detailOrder?.id === pendingDeleteId) setDetailOrder(null);
      toast.success("Order deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete order");
    } finally {
      setDeleteConfirmOpen(false);
      setPendingDeleteId(null);
    }
  };

  // ── Delhivery actions ─────────────────────────────────────────────────────
  const [delhiveryLoading, setDelhiveryLoading] = useState<string | null>(null);
  const [cancelShipmentConfirm, setCancelShipmentConfirm] = useState<string | null>(null);

  const isDelhiveryOrder = (o: OrderWithPayments) =>
    !!o.tracking_number && o.carrier_name === "Delhivery";

  const handleCreateDelhiveryShipment = async (orderId: string) => {
    setDelhiveryLoading(orderId);
    try {
      const res = await post(`/api/orders/${orderId}/shipment`, {}, { requireAdmin: true });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create shipment");
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, tracking_number: data.waybill, carrier_name: "Delhivery", status: "processing" as OrderStatus }
            : o
        )
      );
      setDetailOrder((prev) =>
        prev?.id === orderId
          ? { ...prev, tracking_number: data.waybill, carrier_name: "Delhivery", status: "processing" as OrderStatus }
          : prev
      );
      toast.success(`Shipment created — Waybill: ${data.waybill}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create Delhivery shipment");
    } finally {
      setDelhiveryLoading(null);
    }
  };

  const handleCancelDelhiveryShipment = async (orderId: string) => {
    setDelhiveryLoading(orderId);
    try {
      const res = await post(`/api/orders/${orderId}/shipment/cancel`, {}, { requireAdmin: true });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel shipment");
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: "cancelled" as OrderStatus } : o))
      );
      setDetailOrder((prev) =>
        prev?.id === orderId ? { ...prev, status: "cancelled" as OrderStatus } : prev
      );
      toast.success(data.remark || "Shipment cancelled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel Delhivery shipment");
    } finally {
      setDelhiveryLoading(null);
      setCancelShipmentConfirm(null);
    }
  };

  const handleDownloadLabel = (orderId: string, orderNumber?: string) => {
    const pathParam = orderNumber ?? orderId;
    window.open(`/print/label/${encodeURIComponent(pathParam)}`, "_blank");
  };

  const getStatusIcon = (status: OrderStatus) => {
    switch (status) {
      case "payment_pending": return <Clock className="h-3.5 w-3.5" />;
      case "payment_confirmed": return <Banknote className="h-3.5 w-3.5" />;
      case "processing": return <Package className="h-3.5 w-3.5" />;
      case "shipped": return <Truck className="h-3.5 w-3.5" />;
      case "delivered": return <CheckCircle className="h-3.5 w-3.5" />;
      case "cancelled": return <XCircle className="h-3.5 w-3.5" />;
      case "refunded": return <XCircle className="h-3.5 w-3.5" />;
      default: return <Clock className="h-3.5 w-3.5" />;
    }
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });


  const filteredOrders = orders.filter((order) => {
    if (userFilter && order.customer_email?.toLowerCase() !== userFilter.toLowerCase()) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      order.order_number?.toLowerCase().includes(term) ||
      order.customer_email?.toLowerCase().includes(term) ||
      order.shipping_address?.full_name?.toLowerCase().includes(term) ||
      order.tracking_number?.toLowerCase().includes(term)
    );
  });

  if (showForm) {
    return (
      <OrderForm
        onSuccess={() => { setShowForm(false); fetchOrders(); }}
        onCancel={() => setShowForm(false)}
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Dialogs */}
      {shipOrder && <ShipOrderDialog order={shipOrder} onClose={() => setShipOrder(null)} onShipped={handleShipOrder} />}
      {deleteConfirmOpen && (
        <ConfirmationModal
          title="Delete order?"
          message="This cannot be undone."
          confirmLabel="Delete"
          onConfirm={handleConfirmDelete}
          onCancel={() => { setDeleteConfirmOpen(false); setPendingDeleteId(null); }}
        />
      )}
      {cancelShipmentConfirm && (
        <ConfirmationModal
          title="Cancel Delhivery shipment?"
          message="This will request Delhivery to cancel the shipment. It can only be done before dispatch."
          confirmLabel="Cancel Shipment"
          onConfirm={() => handleCancelDelhiveryShipment(cancelShipmentConfirm)}
          onCancel={() => setCancelShipmentConfirm(null)}
        />
      )}
      {detailOrder && (
        <OrderDetailModal
          order={detailOrder}
          onClose={() => setDetailOrder(null)}
          onStatusChange={handleStatusUpdate}
          onUpdateTracking={handleUpdateTracking}
          onCreateDelhivery={handleCreateDelhiveryShipment}
          onCancelDelhivery={(id) => setCancelShipmentConfirm(id)}
          onDownloadLabel={handleDownloadLabel}
          delhiveryBusy={delhiveryLoading === detailOrder.id}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Orders</h1>
          <p className="text-xs text-gray-400">
            {filteredOrders.length} order{filteredOrders.length !== 1 ? "s" : ""}
            {` · ${DATE_PRESETS.find((p) => p.key === datePreset)?.label ?? "Custom"}${
              datePreset === "custom" && fromDate
                ? ` (${new Date(fromDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" })} – ${new Date(toDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" })})`
                : ""
            }`}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Order
        </Button>
      </div>

      {/* Search + controls */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
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
        <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={fetchOrders} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Collapsible filter panel */}
      {showFilters && (
        <Card>
          <CardContent className="p-4 space-y-4">
            {/* Date presets */}
            <div>
              <Label className="text-xs text-gray-500">Date Range</Label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {DATE_PRESETS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => {
                      setDatePreset(p.key);
                      if (p.key !== "custom") {
                        const { from, to } = presetToDates(p.key);
                        setFromDate(from);
                        setToDate(to);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      datePreset === p.key
                        ? "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {datePreset === "custom" && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <Label className="text-xs text-gray-500">From</Label>
                    <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="mt-1 h-9 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">To</Label>
                    <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="mt-1 h-9 text-sm" />
                  </div>
                </div>
              )}
            </div>
            {/* Status */}
            <div>
              <Label className="text-xs text-gray-500">Status</Label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as OrderStatus | "all")}>
                <SelectTrigger className="mt-1 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Orders</SelectItem>
                  <SelectItem value="payment_pending">Payment Pending</SelectItem>
                  <SelectItem value="payment_confirmed">Payment Confirmed</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Customer */}
            <div>
              <Label className="text-xs text-gray-500">Customer</Label>
              <Select value={userFilter || "all"} onValueChange={(v) => setUserFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="mt-1 h-9 text-sm">
                  <SelectValue placeholder="All Customers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  {users.filter((u) => !!u.email).map((u) => (
                    <SelectItem key={u.id} value={u.email!}>
                      <span className="truncate">
                        {u.full_name ? `${u.full_name} – ${u.email}` : u.email}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <button
              onClick={() => {
                setDatePreset("7d");
                const { from, to } = presetToDates("7d");
                setFromDate(from);
                setToDate(to);
                setStatusFilter("all");
                setUserFilter("");
                setSearchTerm("");
              }}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Reset filters
            </button>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {fetchError && (
        <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 flex-1 truncate">{fetchError}</p>
          <button onClick={fetchOrders} className="text-xs text-red-600 underline shrink-0">Retry</button>
        </div>
      )}

      {/* Orders */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="animate-pulse h-28 bg-gray-100 rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => (
            <div key={order.id} className="bg-white border rounded-xl overflow-hidden">
              {/* Card header */}
              <div className="flex items-center justify-between px-4 pt-3 pb-2 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-sm truncate">
                    #{order.order_number || order.id.slice(0, 8)}
                  </span>
                  <Badge className={`text-xs shrink-0 flex items-center gap-1 ${statusColor[order.status]}`}>
                    {getStatusIcon(order.status)}
                    <span className="capitalize hidden sm:inline">{order.status.replace(/_/g, " ")}</span>
                  </Badge>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 -mr-1">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onClick={() => setDetailOrder(order)}>
                      <Eye className="h-4 w-4 mr-2" />View Details
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {order.status === "payment_pending" && (
                      <DropdownMenuItem onClick={() => handleStatusUpdate(order.id, "payment_confirmed")}>
                        <CheckCircle className="h-4 w-4 mr-2" />Confirm Payment
                      </DropdownMenuItem>
                    )}
                    {order.status === "payment_confirmed" && (
                      <DropdownMenuItem onClick={() => handleStatusUpdate(order.id, "processing")}>
                        <Package className="h-4 w-4 mr-2" />Mark Processing
                      </DropdownMenuItem>
                    )}
                    {order.status === "processing" && (
                      <DropdownMenuItem onClick={() => setShipOrder(order)}>
                        <Truck className="h-4 w-4 mr-2" />Mark Shipped
                      </DropdownMenuItem>
                    )}
                    {(order.status === "processing" || order.status === "payment_confirmed") &&
                      !isDelhiveryOrder(order) && (
                      <DropdownMenuItem
                        onClick={() => handleCreateDelhiveryShipment(order.id)}
                        disabled={delhiveryLoading === order.id}
                      >
                        {delhiveryLoading === order.id
                          ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          : <Send className="h-4 w-4 mr-2" />}
                        Create Delhivery Shipment
                      </DropdownMenuItem>
                    )}
                    {order.status === "shipped" && (
                      <>
                        <DropdownMenuItem onClick={() => setShipOrder(order)}>
                          <Truck className="h-4 w-4 mr-2" />Update Tracking
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusUpdate(order.id, "delivered")}>
                          <CheckCircle className="h-4 w-4 mr-2" />Mark Delivered
                        </DropdownMenuItem>
                      </>
                    )}
                    {isDelhiveryOrder(order) && !["cancelled", "delivered", "refunded"].includes(order.status) && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDownloadLabel(order.id, order.order_number)}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Print Label
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setCancelShipmentConfirm(order.id)}
                          className="text-red-600"
                        >
                          <Ban className="h-4 w-4 mr-2" />Cancel Delhivery Shipment
                        </DropdownMenuItem>
                      </>
                    )}
                    {(order.status === "payment_pending" || order.status === "payment_confirmed" || order.status === "processing") && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleStatusUpdate(order.id, "cancelled")} className="text-red-600">
                          <XCircle className="h-4 w-4 mr-2" />Cancel Order
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuItem onClick={() => handleDeleteOrder(order.id)} className="text-red-600">
                      <XCircle className="h-4 w-4 mr-2" />Delete Order
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Card body */}
              <div className="px-4 pb-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div className="min-w-0">
                  <p className="text-xs text-gray-400">Customer</p>
                  <p className="font-medium truncate">{order.shipping_address?.full_name || "—"}</p>
                  <p className="text-xs text-gray-400 truncate">{order.customer_email}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Total</p>
                  <p className="font-semibold">{fmt(order.total_amount)}</p>
                  <p className="text-xs text-gray-400">{order.items?.length ?? 0} item{(order.items?.length ?? 0) !== 1 ? "s" : ""} · {fmtDate(order.created_at)}</p>
                </div>
              </div>

              {/* Tracking */}
              {order.tracking_number && (
                <div className="px-4 pb-3">
                  <span className="inline-flex items-center gap-1 text-xs text-indigo-700 bg-indigo-50 px-2 py-1 rounded-full font-mono">
                    <Truck className="h-3 w-3" />
                    {order.carrier_name ? `${order.carrier_name}: ` : ""}{order.tracking_number}
                  </span>
                </div>
              )}

            </div>
          ))}

          {!loading && !fetchError && filteredOrders.length === 0 && (
            <div className="text-center py-16">
              <Package className="h-10 w-10 mx-auto text-gray-200 mb-3" />
              <p className="text-sm text-gray-400">
                {searchTerm || statusFilter !== "all" ? "No orders match your filters" : "No orders in this date range"}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
