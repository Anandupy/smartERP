"use client";

import { useQuery } from "@tanstack/react-query";

import { communicationKeys } from "../api/communication.keys";
import { communicationService } from "../api/communication.service";
import type { DeliveryAnalyticsQuery } from "../types/analytics.dto";

/**
 * Delivery analytics for the active scope — six counters and three rates,
 * exactly what `GET /communication/delivery-logs/analytics` documents. No
 * defensive reader is needed here the way audit's summary/timeline need one:
 * this endpoint's response shape *is* stated in
 * `docs/communication-module-ui-spec.md` §9, even though the Postman example
 * is the schema generator's placeholder.
 */
export function useDeliveryAnalytics(query: DeliveryAnalyticsQuery | null) {
  const result = useQuery({
    queryKey: communicationKeys.deliveryLogs.analytics(query ?? {}),
    queryFn: () => communicationService.deliveryLogs.analytics(query ?? {}),
    enabled: query !== null,
    meta: { skipErrorToast: true },
  });

  return { ...result, analytics: result.data ?? null };
}
