"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/hooks/useAuthenticatedFetch";
import type { DelhiveryTrackingResult } from "@/lib/types/delhivery";

interface UseDelhiveryTrackingOptions {
  waybill:  string;
  orderId?: string;
  enabled:  boolean;
}

interface DelhiveryTrackingResponse {
  data:   DelhiveryTrackingResult;
  cached: boolean;
}

export function useDelhiveryTracking({
  waybill,
  orderId,
  enabled,
}: UseDelhiveryTrackingOptions) {
  const { get } = useAuthenticatedFetch();

  return useQuery<DelhiveryTrackingResponse, Error>({
    queryKey: ["admin", "delhivery", "tracking", waybill],
    queryFn: async () => {
      const params = new URLSearchParams({ waybill });
      if (orderId) params.set("order_id", orderId);
      const res = await get(
        `/api/admin/shipping/delhivery/tracking?${params}`,
        { requireAdmin: true }
      );
      return res.json() as Promise<DelhiveryTrackingResponse>;
    },
    enabled: enabled && !!waybill,
    refetchOnWindowFocus: false,
    refetchInterval: enabled ? 90_000 : false,
    refetchIntervalInBackground: false,
    retry: 1,
  });
}
