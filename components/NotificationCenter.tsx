// components/NotificationCenter.tsx
"use client";

import React, {
  useEffect,
  useLayoutEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import Lottie from "lottie-react";
import {
  ShoppingCart,
  Truck,
  CreditCard,
  CheckCircle,
  XCircle,
  Info,
  RefreshCw,
  BellOff,
  X,
  ExternalLink,
} from "lucide-react";
import animationData from "@/components/NotificationV4/notification-V4.json";
import { useAuth } from "@/components/supabase-auth-provider";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  meta?: Record<string, unknown> | null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Supabase returns `created_at` as a bare ISO string with no timezone suffix
 * when the column is `timestamp without time zone`.  Without "Z", JS treats it
 * as local time — causing a 5h30m shift for IST users.  Force UTC parsing.
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
  return toUTC(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** Full date + time in the browser's locale and system timezone. */
function systemDateTime(iso: string): string {
  return toUTC(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Per-type colour palette ──────────────────────────────────────────────────

type TypeColors = {
  iconEl: React.ReactNode;
  badgeClass: string;
  badgeLabel: string;
  rowBg: string;            // unread row background
  dotColor: string;         // unread indicator dot
};

function getTypeColors(type: string): TypeColors {
  switch (type) {
    case "order_status":
      return {
        iconEl: <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100"><ShoppingCart className="h-4 w-4 text-blue-600" /></span>,
        badgeClass: "bg-blue-100 text-blue-800 font-semibold",
        badgeLabel: "Order",
        rowBg: "bg-blue-50/50",
        dotColor: "bg-blue-500",
      };
    case "shipping_scan":
      return {
        iconEl: <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100"><Truck className="h-4 w-4 text-orange-600" /></span>,
        badgeClass: "bg-orange-100 text-orange-800 font-semibold",
        badgeLabel: "Shipment",
        rowBg: "bg-orange-50/50",
        dotColor: "bg-orange-500",
      };
    case "payment_status":
      return {
        iconEl: <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100"><CreditCard className="h-4 w-4 text-violet-600" /></span>,
        badgeClass: "bg-violet-100 text-violet-800 font-semibold",
        badgeLabel: "Payment",
        rowBg: "bg-violet-50/50",
        dotColor: "bg-violet-500",
      };
    case "success":
      return {
        iconEl: <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100"><CheckCircle className="h-4 w-4 text-emerald-600" /></span>,
        badgeClass: "bg-emerald-100 text-emerald-800 font-semibold",
        badgeLabel: "Success",
        rowBg: "bg-emerald-50/50",
        dotColor: "bg-emerald-500",
      };
    case "error":
      return {
        iconEl: <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100"><XCircle className="h-4 w-4 text-red-600" /></span>,
        badgeClass: "bg-red-100 text-red-800 font-semibold",
        badgeLabel: "Alert",
        rowBg: "bg-red-50/40",
        dotColor: "bg-red-500",
      };
    default:
      return {
        iconEl: <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100"><Info className="h-4 w-4 text-gray-500" /></span>,
        badgeClass: "bg-gray-100 text-gray-600 font-semibold",
        badgeLabel: "Info",
        rowBg: "bg-gray-50/50",
        dotColor: "bg-gray-400",
      };
  }
}

// ── Display-details extraction ───────────────────────────────────────────────

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
};

const EMPTY_DETAILS: DisplayDetails = {
  customerName: null, customerEmail: null, orderNumber: null,
  orderId: null, awb: null, location: null,
};

function getDisplayDetails(n: Notification): DisplayDetails {
  const meta = n.meta as Record<string, unknown> | null;
  if (meta) {
    // Legacy-backfilled notifications carry the *current* order status, not the
    // event-time status — suppress to avoid contradicting the notification title.
    return {
      customerName: typeof meta.customer_name === "string" ? meta.customer_name : null,
      customerEmail: typeof meta.customer_email === "string" ? meta.customer_email : null,
      orderNumber: typeof meta.order_number === "string" ? meta.order_number : null,
      orderId: typeof meta.order_id === "string" ? meta.order_id : null,
      awb: typeof meta.awb === "string" ? meta.awb : null,
      location: typeof meta.scan_location === "string" ? meta.scan_location : null,
    };
  }
  // Legacy notifications: extract customer from message text
  const msg = n.message ?? "";
  const ACTION_KEYWORDS = [" order confirmed", " checkout session", " order ", " payment ", " shipment "];
  let rawCustomer: string | null = null;
  for (const kw of ACTION_KEYWORDS) {
    const idx = msg.indexOf(kw);
    if (idx > 0) { rawCustomer = msg.slice(0, idx).trim(); break; }
  }
  if (!rawCustomer && msg.includes("@")) rawCustomer = msg.split(" ")[0] ?? null;
  if (!rawCustomer) return EMPTY_DETAILS;
  const { displayName, email } = parseCustomerIdentifier(rawCustomer);
  return { ...EMPTY_DETAILS, customerName: displayName, customerEmail: email };
}

function hasAnyDetails(d: DisplayDetails): boolean {
  return Object.values(d).some((v) => v !== null);
}

// ── Component ────────────────────────────────────────────────────────────────

export default function NotificationCenter() {
  const { jwtToken } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markingAsRead, setMarkingAsRead] = useState<Set<string>>(new Set());
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const markingAsReadRef = useRef<Set<string>>(new Set());
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  const fetchNotifications = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        if (!opts?.silent) setLoading(true);
        setError(null);

        const headers = new Headers();
        if (jwtToken) headers.set("Authorization", `Bearer ${jwtToken}`);

        const res = await fetch("/api/notifications", {
          signal: abortController.signal,
          credentials: "same-origin",
          headers,
        });

        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();

        if (isMountedRef.current && !abortController.signal.aborted) {
          setNotifications(data.notifications ?? []);
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        if (isMountedRef.current) {
          setError("Could not load notifications.");
          setNotifications([]);
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [jwtToken]
  );

  useEffect(() => {
    isMountedRef.current = true;
    fetchNotifications();
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, [fetchNotifications]);

  useEffect(() => {
    if (open) fetchNotifications({ silent: true });
  }, [open, fetchNotifications]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications({ silent: true });
  }, [fetchNotifications]);

  const markAsRead = useCallback(
    async (id: string) => {
      if (markingAsReadRef.current.has(id)) return;
      markingAsReadRef.current.add(id);
      setMarkingAsRead((prev) => new Set(prev).add(id));

      try {
        const headers = new Headers();
        if (jwtToken) headers.set("Authorization", `Bearer ${jwtToken}`);
        const res = await fetch(`/api/notifications/${id}`, {
          method: "PATCH",
          credentials: "same-origin",
          headers,
        });
        if (!res.ok) throw new Error(`${res.status}`);
        if (isMountedRef.current) {
          setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
          );
        }
      } catch {
        // silent — user can retry
      } finally {
        markingAsReadRef.current.delete(id);
        if (isMountedRef.current) {
          setMarkingAsRead((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }
      }
    },
    [jwtToken]
  );

  const markAllRead = useCallback(async () => {
    const unread = notifications.filter((n) => !n.is_read);
    for (const n of unread) {
      await markAsRead(n.id);
    }
  }, [notifications, markAsRead]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const PANEL_WIDTH_PX = 380;
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const update = () => {
      const el = buttonRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      let left = rect.right - PANEL_WIDTH_PX;
      const margin = 8;
      left = Math.max(margin, Math.min(left, window.innerWidth - PANEL_WIDTH_PX - margin));
      setPanelStyle({ top: rect.bottom + 8, left, zIndex: 9999 });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const hasUnread = unreadCount > 0;

  const panel = open ? (
    <div
      ref={panelRef}
      data-notification-panel
      className="fixed bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col"
      style={{ ...panelStyle, width: PANEL_WIDTH_PX, maxHeight: "calc(100vh - 100px)", maxWidth: "calc(100vw - 16px)" }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900 text-sm">Notifications</span>
          {hasUnread && (
            <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-blue-600 text-white text-[10px] font-bold tabular-nums">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {hasUnread && (
            <button
              onClick={markAllRead}
              className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 transition-colors font-medium"
            >
              Mark all read
            </button>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="overflow-y-auto flex-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-400">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-red-400">
            <XCircle className="h-6 w-6" />
            <span className="text-sm">{error}</span>
            <button
              onClick={handleRefresh}
              className="text-xs text-blue-600 hover:underline mt-1"
            >
              Try again
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-14 text-gray-400">
            <BellOff className="h-7 w-7 text-gray-300" />
            <p className="text-sm font-medium text-gray-500">No notifications yet</p>
            <p className="text-xs text-gray-400">You&apos;re all caught up!</p>
          </div>
        ) : (
          <ul>
            {notifications.map((n) => {
              const isBusy = markingAsRead.has(n.id);
              const details = getDisplayDetails(n);
              const showDetails = hasAnyDetails(details);
              const colors = getTypeColors(n.type);
              return (
                <li key={n.id} className={`border-b border-gray-50 last:border-0 ${n.is_read ? "" : colors.rowBg}`}>
                  <button
                    type="button"
                    onClick={() => !n.is_read && !isBusy && markAsRead(n.id)}
                    disabled={n.is_read || isBusy}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors hover:bg-gray-50/80 ${isBusy ? "opacity-60 cursor-wait" : ""} ${n.is_read ? "cursor-default" : "cursor-pointer"}`}
                  >
                    {/* Icon */}
                    {colors.iconEl}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wide ${colors.badgeClass}`}>
                          {colors.badgeLabel}
                        </span>
                        {!n.is_read && (
                          <span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${colors.dotColor}`} />
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-900 mt-0.5 leading-snug">
                        {n.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-2">
                        {n.message}
                      </p>
                      {/* Details grid — shown for all notifications (meta or legacy-parsed) */}
                      {showDetails && (
                        <div className="mt-2 rounded-lg bg-gray-50 border border-gray-100 divide-y divide-gray-100 text-[11px]">
                          {(details.customerName || details.customerEmail) && (
                            <div className="flex items-start gap-2 px-2.5 py-1.5">
                              <span className="text-gray-400 w-14 shrink-0 font-medium mt-px">Customer</span>
                              <div className="min-w-0">
                                {details.customerName && (
                                  <span className="block font-semibold text-gray-900">{details.customerName}</span>
                                )}
                                {details.customerEmail && (
                                  <span className={`block ${details.customerName ? "text-[10px] text-gray-500" : "font-medium text-gray-800"} truncate`}>
                                    {details.customerEmail}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                          {details.orderNumber && (
                            <div className="flex items-center gap-2 px-2.5 py-1.5">
                              <span className="text-gray-400 w-14 shrink-0 font-medium">Order #</span>
                              <span className="text-gray-900 font-mono font-bold">{details.orderNumber}</span>
                            </div>
                          )}
                          {details.orderId && (
                            <div className="flex items-center gap-2 px-2.5 py-1.5">
                              <span className="text-gray-400 w-14 shrink-0 font-medium">Order ID</span>
                              <span
                                className="text-gray-500 font-mono truncate"
                                title={details.orderId}
                              >
                                {details.orderId}
                              </span>
                            </div>
                          )}
                          {details.awb && (
                            <div className="flex items-center gap-2 px-2.5 py-1.5">
                              <span className="text-gray-400 w-14 shrink-0 font-medium">AWB No.</span>
                              <span className="text-amber-700 font-mono font-bold tracking-wide">{details.awb}</span>
                            </div>
                          )}
                          {details.location && (
                            <div className="flex items-center gap-2 px-2.5 py-1.5">
                              <span className="text-gray-400 w-14 shrink-0 font-medium">Location</span>
                              <span className="text-gray-700 truncate">📍 {details.location}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Single timestamp — hover for full date in system locale */}
                    <time
                      className="shrink-0 text-[10px] text-gray-400 mt-0.5 tabular-nums cursor-default"
                      dateTime={n.created_at}
                      title={systemDateTime(n.created_at)}
                    >
                      {relativeTime(n.created_at)}
                    </time>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 px-4 py-2.5 bg-gray-50">
        <a
          href="/notifications"
          className="flex items-center justify-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
          onClick={() => setOpen(false)}
        >
          View all notifications
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  ) : null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        data-notification-button
        onClick={() => setOpen(!open)}
        className="relative pt-2"
        aria-label="Toggle notifications"
      >
        <Lottie
          animationData={animationData}
          loop={hasUnread}
          autoplay={hasUnread}
          style={{ width: 30, height: 30 }}
        />
        {hasUnread && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white tabular-nums shadow">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {typeof window !== "undefined" && open && createPortal(panel, document.body)}
    </div>
  );
}
