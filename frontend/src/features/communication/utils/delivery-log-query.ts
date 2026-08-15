import { ANY, DATE_PRESETS, type DatePreset } from "../constants";
import {
  DELIVERY_LOG_PAGE_SIZE_DEFAULT,
  type DeliveryLogQuery,
} from "../types/delivery-log.dto";

/**
 * Turning the Delivery Logs screen's filter state into the documented query
 * parameters. Mirrors the audit module's `utils/query.ts`: kept out of the
 * hooks module since none of it needs React, and it is the part most worth
 * testing directly.
 */

export interface DeliveryLogFilters {
  recipient: string;
  channel: string;
  status: string;
  provider: string;
  datePreset: DatePreset;
  page: number;
  limit: number;
}

export function deliveryLogFilterDefaults(): DeliveryLogFilters {
  return {
    recipient: "",
    channel: ANY,
    status: ANY,
    provider: ANY,
    datePreset: "ALL",
    page: 1,
    limit: DELIVERY_LOG_PAGE_SIZE_DEFAULT,
  };
}

/**
 * Filter state + active scope → the documented query parameters.
 *
 * `ANY` and `""` are translated to *absence* here — the service's `compact`
 * strips `undefined`, but an empty `recipient=` would still narrow the list to
 * nothing.
 */
export function toDeliveryLogQuery(
  filters: DeliveryLogFilters,
  scope: { organizationId: string; branchId: string },
): DeliveryLogQuery {
  const preset = DATE_PRESETS.find((entry) => entry.value === filters.datePreset);
  const startDate =
    preset && preset.days !== null
      ? new Date(Date.now() - preset.days * 24 * 60 * 60 * 1000).toISOString()
      : undefined;

  return {
    page: filters.page,
    limit: filters.limit,
    channel: filters.channel === ANY ? undefined : filters.channel,
    status: filters.status === ANY ? undefined : filters.status,
    provider: filters.provider === ANY ? undefined : filters.provider,
    recipient: filters.recipient.trim() || undefined,
    startDate,
    organizationId: scope.organizationId,
    branchId: scope.branchId,
  };
}

export function countActiveDeliveryLogFilters(filters: DeliveryLogFilters): number {
  return (
    (filters.recipient.trim() ? 1 : 0) +
    (filters.channel !== ANY ? 1 : 0) +
    (filters.status !== ANY ? 1 : 0) +
    (filters.provider !== ANY ? 1 : 0) +
    (filters.datePreset !== "ALL" ? 1 : 0)
  );
}
