"use client";

import { useQuery } from "@tanstack/react-query";

import type { PaginationMeta } from "@/types/api";

import { communicationKeys } from "../api/communication.keys";
import { communicationService } from "../api/communication.service";
import type { DeliveryLogQuery } from "../types/delivery-log.dto";

/**
 * A page of delivery logs — server-paginated and server-filtered, per the ten
 * documented query parameters.
 *
 * `query === null` disables the fetch entirely, the same gate every other
 * scoped hook in this module uses, so a screen composing this before a
 * workspace scope is known never fires a request with half a scope.
 *
 * `placeholderData` keeps the previous page on screen while the next loads.
 * The envelope's flat `meta` (`total`, `page`, `limit`, `totalPages`) is
 * translated once, here, into the platform's shared `PaginationMeta` shape so
 * the explorer and pager stay identical to every other list in the app —
 * mirroring how the audit module translates its own differently-shaped
 * pagination.
 */
export function useDeliveryLogs(query: DeliveryLogQuery | null) {
  const result = useQuery({
    queryKey: communicationKeys.deliveryLogs.list(query ?? {}),
    queryFn: () => communicationService.deliveryLogs.list(query ?? {}),
    enabled: query !== null,
    meta: { skipErrorToast: true },
    placeholderData: (previous) => previous,
  });

  const envelope = result.data;
  const meta = envelope?.meta as
    | { total?: number; page?: number; limit?: number; totalPages?: number }
    | null
    | undefined;

  const pagination: PaginationMeta | null =
    meta && typeof meta.total === "number"
      ? {
          page: meta.page ?? query?.page ?? 1,
          pageSize: meta.limit ?? query?.limit ?? 25,
          total: meta.total,
          totalPages: meta.totalPages ?? 1,
        }
      : null;

  return {
    ...result,
    logs: envelope?.data ?? [],
    pagination,
  };
}
