"use client";

import React, { useState } from "react";
import { Truck, RefreshCw, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useDelhiveryTracking } from "@/hooks/useDelhiveryTracking";
import type { Order } from "@/lib/types/order";
import type { DelhiveryScan } from "@/lib/types/delhivery";

interface DelhiveryTrackingPanelProps {
  order: Order;
}

function formatRelativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

function formatScanTime(time: string): string {
  return new Date(time).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ScanRow({ scan }: { scan: DelhiveryScan }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-400" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-800">{scan.status}</p>
        <p className="text-xs text-gray-500">
          {formatScanTime(scan.time)}
          {scan.location ? ` · ${scan.location}` : ""}
        </p>
        {scan.activity && (
          <p className="text-xs text-gray-400 italic">{scan.activity}</p>
        )}
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-start gap-3 py-2 animate-pulse">
      <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-gray-200" />
      <div className="flex-1 space-y-1">
        <div className="h-3 w-32 rounded bg-gray-200" />
        <div className="h-3 w-48 rounded bg-gray-100" />
      </div>
    </div>
  );
}

export default function DelhiveryTrackingPanel({ order }: DelhiveryTrackingPanelProps) {
  const [showAll, setShowAll] = useState(false);

  const { data, isLoading, isFetching, isError, error, refetch, dataUpdatedAt } =
    useDelhiveryTracking({
      waybill:  order.tracking_number!,
      orderId:  order.id,
      enabled:  true,
    });

  const result        = data?.data;
  const scans         = result?.scans ?? [];
  const visibleScans  = showAll ? scans : scans.slice(0, 3);
  const hasMoreScans  = scans.length > 3;

  // Persisted summary (shown before live data arrives)
  const persistedStatus   = order.delhivery_latest_status;
  const persistedScanAt   = order.delhivery_latest_scan_at;
  const persistedLocation = order.delhivery_latest_location;
  const hasPersisted = !!persistedStatus;

  const liveStatus   = result?.current_status;
  const liveLocation = result?.current_location;
  const displayStatus   = liveStatus   ?? persistedStatus;
  const displayLocation = liveLocation ?? persistedLocation;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
          <Truck className="h-3 w-3" /> Delhivery Tracking
        </p>
        <div className="flex items-center gap-2">
          {dataUpdatedAt > 0 && (
            <span className="text-xs text-gray-400">
              {formatRelativeTime(new Date(dataUpdatedAt).toISOString())}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Refresh tracking"
          >
            <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Persisted summary (quick, shown before live data) */}
      {hasPersisted && !result && (
        <div className="rounded-md bg-indigo-50 px-3 py-2 text-xs text-indigo-700 space-y-0.5">
          <p className="font-medium">{persistedStatus}</p>
          {persistedLocation && <p className="text-indigo-500">{persistedLocation}</p>}
          {persistedScanAt && (
            <p className="text-indigo-400">
              Last scan: {formatScanTime(persistedScanAt)}
            </p>
          )}
        </div>
      )}

      {/* Loading skeleton + spinner on first fetch */}
      {isLoading && !hasPersisted && (
        <div className="divide-y divide-gray-50 rounded-lg border px-3">
          <div className="flex items-center gap-2 py-2">
            <RefreshCw className="h-3 w-3 animate-spin text-gray-400" />
            <span className="text-xs text-gray-400">Loading tracking…</span>
          </div>
          <SkeletonRow />
          <SkeletonRow />
        </div>
      )}

      {/* Error state */}
      {isError && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-2 text-xs">
            <span>{error?.message ?? "Failed to load tracking"}</span>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Live status banner */}
      {result && displayStatus && displayStatus !== "no_data" && (
        <div className="rounded-md bg-indigo-50 px-3 py-2 text-xs text-indigo-700 space-y-0.5">
          <p className="font-medium">{displayStatus}</p>
          {displayLocation && <p className="text-indigo-500">{displayLocation}</p>}
        </div>
      )}

      {/* No scans */}
      {result && scans.length === 0 && !isError && (
        <p className="text-xs text-gray-400 italic">No scans yet for this shipment.</p>
      )}

      {/* Scan timeline */}
      {scans.length > 0 && (
        <div className="divide-y divide-gray-50 rounded-lg border px-3">
          {visibleScans.map((scan, i) => (
            <ScanRow key={`${scan.time}-${i}`} scan={scan} />
          ))}
          {hasMoreScans && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="flex w-full items-center justify-center gap-1 py-2 text-xs text-gray-500 hover:text-gray-700"
            >
              {showAll ? (
                <><ChevronUp className="h-3 w-3" /> Show less</>
              ) : (
                <><ChevronDown className="h-3 w-3" /> Show all {scans.length} scans</>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
