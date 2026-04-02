"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ShoppingCart,
  Truck,
  CreditCard,
  CheckCircle,
  XCircle,
  Info,
  RefreshCw,
  Loader2,
  BellOff,
  MapPin,
  Hash,
  Package,
  User,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/supabase-auth-provider";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  meta?: Record<string, unknown> | null;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Supabase returns `created_at` as a bare ISO string with no timezone suffix
 * (e.g. "2026-04-01T15:40:30.568845") when the column type is
 * `timestamp without time zone`.  JavaScript treats bare ISO strings as local
 * time, which causes a 5 h 30 m shift for IST users.  Appending "Z" forces
 * the parser to treat the value as UTC, which is what Postgres stores.
 */
function toUTC(iso: string): Date {
  return new Date(/[Z+\-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`);
}

function relativeTime(iso: string): string {
  const diff = Date.now() - toUTC(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return toUTC(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Full date + time using the browser's locale and system timezone. */
function systemDateTime(iso: string): string {
  return toUTC(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Per-type colour palette ───────────────────────────────────────────────────

type TypeColors = {
  iconBg: string;
  icon: React.ReactNode;
  badgeClass: string;
  badgeLabel: string;
  accentBar: string;       // left accent bar (unread)
  cardBorder: string;      // card border (unread)
  cardBg: string;          // card bg (unread)
};

function getTypeColors(type: string): TypeColors {
  switch (type) {
    case "order_status":
      return {
        iconBg: "bg-blue-100",
        icon: <ShoppingCart className="h-5 w-5 text-blue-600" />,
        badgeClass: "border-blue-300 bg-blue-100 text-blue-800 font-semibold",
        badgeLabel: "Order",
        accentBar: "bg-blue-500",
        cardBorder: "border-blue-200",
        cardBg: "bg-blue-50/40",
      };
    case "shipping_scan":
      return {
        iconBg: "bg-orange-100",
        icon: <Truck className="h-5 w-5 text-orange-600" />,
        badgeClass: "border-orange-300 bg-orange-100 text-orange-800 font-semibold",
        badgeLabel: "Shipment",
        accentBar: "bg-orange-500",
        cardBorder: "border-orange-200",
        cardBg: "bg-orange-50/40",
      };
    case "payment_status":
      return {
        iconBg: "bg-violet-100",
        icon: <CreditCard className="h-5 w-5 text-violet-600" />,
        badgeClass: "border-violet-300 bg-violet-100 text-violet-800 font-semibold",
        badgeLabel: "Payment",
        accentBar: "bg-violet-500",
        cardBorder: "border-violet-200",
        cardBg: "bg-violet-50/40",
      };
    case "success":
      return {
        iconBg: "bg-emerald-100",
        icon: <CheckCircle className="h-5 w-5 text-emerald-600" />,
        badgeClass: "border-emerald-300 bg-emerald-100 text-emerald-800 font-semibold",
        badgeLabel: "Success",
        accentBar: "bg-emerald-500",
        cardBorder: "border-emerald-200",
        cardBg: "bg-emerald-50/40",
      };
    case "error":
      return {
        iconBg: "bg-red-100",
        icon: <XCircle className="h-5 w-5 text-red-600" />,
        badgeClass: "border-red-300 bg-red-100 text-red-800 font-semibold",
        badgeLabel: "Alert",
        accentBar: "bg-red-500",
        cardBorder: "border-red-200",
        cardBg: "bg-red-50/30",
      };
    default:
      return {
        iconBg: "bg-gray-100",
        icon: <Info className="h-5 w-5 text-gray-500" />,
        badgeClass: "border-gray-200 bg-gray-100 text-gray-600 font-semibold",
        badgeLabel: "Info",
        accentBar: "bg-gray-400",
        cardBorder: "border-gray-200",
        cardBg: "bg-gray-50/40",
      };
  }
}

// ── Display-details extraction ────────────────────────────────────────────────

/** Parse Supabase phone-auth identifiers (phone+917667659336@phone.*) into a human-readable form. */
function parseCustomerIdentifier(raw: string): { displayName: string | null; email: string | null } {
  const phoneMatch = raw.match(/^phone\+(\d+)@phone\./);
  if (phoneMatch) return { displayName: `+${phoneMatch[1]}`, email: null };
  if (raw.includes("@")) return { displayName: null, email: raw };
  return { displayName: raw, email: null };
}

type DisplayDetails = {
  customerName: string | null;
  customerEmail: string | null;
  orderNumber: string | null;
  orderId: string | null;
  awb: string | null;
  location: string | null;
  orderStatus: string | null;
  paymentStatus: string | null;
};

const EMPTY_DETAILS: DisplayDetails = {
  customerName: null, customerEmail: null, orderNumber: null, orderId: null,
  awb: null, location: null, orderStatus: null, paymentStatus: null,
};

function getDisplayDetails(n: NotificationItem): DisplayDetails {
  const meta = n.meta as Record<string, unknown> | null;

  if (meta) {
    // Legacy-backfilled notifications store the *current* order status, not the
    // status at the time of the event — showing it contradicts the notification
    // title (e.g. "Order Success" + "cancelled"). Suppress it for legacy rows.
    const isLegacy = meta.lifecycle_event === "legacy_backfill";
    return {
      customerName: typeof meta.customer_name === "string" ? meta.customer_name : null,
      customerEmail: typeof meta.customer_email === "string" ? meta.customer_email : null,
      orderNumber: typeof meta.order_number === "string" ? meta.order_number : null,
      orderId: typeof meta.order_id === "string" ? meta.order_id : null,
      awb: typeof meta.awb === "string" ? meta.awb : null,
      location: typeof meta.scan_location === "string" ? meta.scan_location : null,
      orderStatus: !isLegacy && typeof meta.order_status === "string" ? meta.order_status : null,
      paymentStatus: !isLegacy && typeof meta.payment_status === "string" ? meta.payment_status : null,
    };
  }

  // Legacy notifications have no meta — extract customer from the message text.
  // Format: "{customer_identifier} {action phrase}"
  const msg = n.message ?? "";
  const ACTION_KEYWORDS = [" order confirmed", " checkout session", " order ", " payment ", " shipment "];
  let rawCustomer: string | null = null;
  for (const kw of ACTION_KEYWORDS) {
    const idx = msg.indexOf(kw);
    if (idx > 0) { rawCustomer = msg.slice(0, idx).trim(); break; }
  }
  // Fallback: first space-separated token that looks like an identifier
  if (!rawCustomer && msg.includes("@")) rawCustomer = msg.split(" ")[0] ?? null;
  if (!rawCustomer) return EMPTY_DETAILS;

  const { displayName, email } = parseCustomerIdentifier(rawCustomer);
  return { ...EMPTY_DETAILS, customerName: displayName, customerEmail: email };
}

function hasAnyDetails(d: DisplayDetails): boolean {
  return Object.values(d).some((v) => v !== null);
}

// ── Component ────────────────────────────────────────────────────────────────

export default function NotificationsListPage() {
  const { jwtToken } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [listRefreshing, setListRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markingIds, setMarkingIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const buildHeaders = useCallback(() => {
    const headers = new Headers();
    if (jwtToken) headers.set("Authorization", `Bearer ${jwtToken}`);
    return headers;
  }, [jwtToken]);

  const fetchPage = useCallback(
    async (cursor: string | null, append: boolean, opts?: { manualRefresh?: boolean }) => {
      try {
        if (append) setLoadingMore(true);
        else if (opts?.manualRefresh) setListRefreshing(true);
        else setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (cursor) params.set("cursor", cursor);

        const res = await fetch(`/api/notifications?${params.toString()}`, {
          credentials: "same-origin",
          headers: buildHeaders(),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(typeof body.error === "string" ? body.error : `Failed (${res.status})`);
        }

        const data = await res.json();
        const next: NotificationItem[] = data.notifications ?? [];
        setNextCursor(data.next_cursor ?? null);
        setItems((prev) => (append ? [...prev, ...next] : next));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load notifications");
        if (!append) setItems([]);
      } finally {
        setLoading(false);
        setListRefreshing(false);
        setLoadingMore(false);
      }
    },
    [buildHeaders]
  );

  useEffect(() => {
    fetchPage(null, false);
  }, [fetchPage]);

  const markAsRead = useCallback(
    async (id: string) => {
      if (markingIds.has(id)) return;
      setMarkingIds((prev) => new Set(prev).add(id));
      try {
        const res = await fetch(`/api/notifications/${id}`, {
          method: "PATCH",
          credentials: "same-origin",
          headers: buildHeaders(),
        });
        if (!res.ok) throw new Error("Failed to mark as read");
        setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      } catch {
        // silent; user can retry
      } finally {
        setMarkingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [markingIds, buildHeaders]
  );

  const markAllRead = useCallback(async () => {
    const unread = items.filter((n) => !n.is_read);
    for (const n of unread) {
      await markAsRead(n.id);
    }
  }, [items, markAsRead]);

  const displayed = filter === "unread" ? items.filter((n) => !n.is_read) : items;
  const unreadCount = items.filter((n) => !n.is_read).length;

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center flex-col gap-3 text-gray-400">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="text-sm">Loading notifications…</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Notifications</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Order, payment and shipment updates for your admin account.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {unreadCount > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={markAllRead}
              className="text-sm gap-1.5"
            >
              <CheckCircle className="h-3.5 w-3.5 text-green-600" />
              Mark all read
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fetchPage(null, false, { manualRefresh: true })}
            disabled={listRefreshing || loadingMore}
            aria-label="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${listRefreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* ── Filter Tabs ── */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        {(["all", "unread"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
              filter === tab
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {tab === "all" ? `All (${items.length})` : `Unread (${unreadCount})`}
          </button>
        ))}
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <XCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── List ── */}
      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-gray-400">
          <BellOff className="h-10 w-10 text-gray-300" />
          <div className="text-center">
            <p className="font-medium text-gray-500">
              {filter === "unread" ? "No unread notifications" : "No notifications yet"}
            </p>
            <p className="text-sm mt-1 text-gray-400">
              {filter === "unread"
                ? "You're all caught up! 🎉"
                : "Order and shipment updates will appear here."}
            </p>
          </div>
          {filter === "unread" && (
            <Button variant="outline" size="sm" onClick={() => setFilter("all")}>
              View all notifications
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map((n) => {
            const colors = getTypeColors(n.type);
            const isBusy = markingIds.has(n.id);

            const details = getDisplayDetails(n);
            const showDetails = hasAnyDetails(details);

            return (
              <div
                key={n.id}
                className={`group relative rounded-xl border transition-all duration-150 overflow-hidden ${
                  n.is_read
                    ? "border-gray-200 bg-white hover:bg-gray-50/60"
                    : `${colors.cardBorder} ${colors.cardBg} shadow-sm`
                } ${isBusy ? "opacity-60" : ""}`}
              >
                {/* Unread accent bar — type-coloured */}
                {!n.is_read && (
                  <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${colors.accentBar}`} />
                )}

                <div className="flex items-start gap-4 px-5 py-4 pl-6">
                  {/* Icon */}
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${colors.iconBg} mt-0.5`}>
                    {colors.icon}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`text-[10px] px-2 py-0 h-5 ${colors.badgeClass}`}>
                          {colors.badgeLabel}
                        </Badge>
                        {!n.is_read && (
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold`} style={{ color: "inherit" }}>
                            <span className={`h-1.5 w-1.5 rounded-full inline-block ${colors.accentBar}`} />
                            <span className="text-gray-600">New</span>
                          </span>
                        )}
                      </div>
                      {/* Relative time — hover shows full datetime */}
                      <time
                        className="text-xs text-gray-400 shrink-0 tabular-nums cursor-default"
                        dateTime={n.created_at}
                        title={systemDateTime(n.created_at)}
                      >
                        {relativeTime(n.created_at)}
                      </time>
                    </div>

                    <h3 className="mt-1 text-sm font-semibold text-gray-900 leading-snug">
                      {n.title}
                    </h3>
                    <p className="mt-0.5 text-sm text-gray-600 leading-relaxed">
                      {n.message}
                    </p>

                    {/* Details grid — shown for ALL notifications (meta-based or legacy-parsed) */}
                    {showDetails && (
                      <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50/80 overflow-hidden text-xs">
                        {/* Customer */}
                        {(details.customerName || details.customerEmail) && (
                          <div className="flex items-start gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0">
                            <div className="flex items-center gap-1.5 text-gray-400 w-24 shrink-0 mt-0.5">
                              <User className="h-3.5 w-3.5" />
                              <span className="font-medium">Customer</span>
                            </div>
                            <div className="min-w-0">
                              {details.customerName && (
                                <span className="block font-semibold text-gray-900">{details.customerName}</span>
                              )}
                              {details.customerEmail && (
                                <span className={`block ${details.customerName ? "text-[11px] text-gray-500" : "font-medium text-gray-800"}`}>
                                  {details.customerEmail}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        {/* Order number */}
                        {details.orderNumber && (
                          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0">
                            <div className="flex items-center gap-1.5 text-gray-400 w-24 shrink-0">
                              <Hash className="h-3.5 w-3.5" />
                              <span className="font-medium">Order #</span>
                            </div>
                            <span className="font-mono font-bold text-gray-900 text-sm">{details.orderNumber}</span>
                          </div>
                        )}
                        {/* Order ID — full UUID with copy */}
                        {details.orderId && (
                          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0">
                            <div className="flex items-center gap-1.5 text-gray-400 w-24 shrink-0">
                              <Copy className="h-3.5 w-3.5" />
                              <span className="font-medium">Order ID</span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard?.writeText(details.orderId!);
                              }}
                              title={details.orderId}
                              className="font-mono text-gray-600 hover:text-blue-700 transition-colors cursor-copy truncate max-w-xs"
                            >
                              {details.orderId}
                            </button>
                          </div>
                        )}
                        {/* AWB */}
                        {details.awb && (
                          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0">
                            <div className="flex items-center gap-1.5 text-gray-400 w-24 shrink-0">
                              <Package className="h-3.5 w-3.5" />
                              <span className="font-medium">AWB No.</span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard?.writeText(details.awb!);
                              }}
                              title="Click to copy"
                              className="font-mono font-bold text-amber-700 tracking-wide hover:text-amber-900 transition-colors cursor-copy"
                            >
                              {details.awb}
                            </button>
                          </div>
                        )}
                        {/* Scan location */}
                        {details.location && (
                          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0">
                            <div className="flex items-center gap-1.5 text-gray-400 w-24 shrink-0">
                              <MapPin className="h-3.5 w-3.5" />
                              <span className="font-medium">Location</span>
                            </div>
                            <span className="text-gray-700">{details.location}</span>
                          </div>
                        )}
                        {/* Order status */}
                        {details.orderStatus && (
                          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0">
                            <div className="flex items-center gap-1.5 text-gray-400 w-24 shrink-0">
                              <ShoppingCart className="h-3.5 w-3.5" />
                              <span className="font-medium">Status</span>
                            </div>
                            <span className="font-semibold text-indigo-700 capitalize">
                              {details.orderStatus.replace(/_/g, " ")}
                            </span>
                          </div>
                        )}
                        {/* Payment status */}
                        {details.paymentStatus && (
                          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0">
                            <div className="flex items-center gap-1.5 text-gray-400 w-24 shrink-0">
                              <CreditCard className="h-3.5 w-3.5" />
                              <span className="font-medium">Payment</span>
                            </div>
                            <span className="font-semibold text-green-700 capitalize">
                              {details.paymentStatus.replace(/_/g, " ")}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Footer: action only (time shown top-right; hover for full date) */}
                    {(!n.is_read || isBusy) && (
                      <div className="mt-2.5 flex justify-end">
                        <button
                          type="button"
                          onClick={() => !isBusy && markAsRead(n.id)}
                          disabled={isBusy}
                          className="text-[11px] font-medium text-blue-600 hover:text-blue-800 transition-colors disabled:opacity-50"
                        >
                          {isBusy ? "Marking…" : "Mark as read"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Load More ── */}
      {nextCursor && filter === "all" && (
        <div className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => fetchPage(nextCursor, true)}
            disabled={loadingMore}
            className="w-full"
          >
            {loadingMore ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading more…
              </>
            ) : (
              "Load more notifications"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
