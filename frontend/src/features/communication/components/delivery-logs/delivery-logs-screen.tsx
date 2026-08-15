"use client";

import { useMemo, useState } from "react";

import { ScrollText } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebouncedValue } from "@/hooks";
import {
  DataTablePagination,
  DataTableToolbar,
} from "@/shared/components/data";
import { EmptyState } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";

import {
  ANY,
  CHANNEL_OPTIONS,
  DATE_PRESETS,
  DELIVERY_STATUS_OPTIONS,
  type DatePreset,
} from "../../constants";
import { useCommunicationScope } from "../../hooks/use-communication-scope";
import { useDeliveryLogs } from "../../hooks/use-delivery-logs";
import {
  countActiveDeliveryLogFilters,
  deliveryLogFilterDefaults,
  toDeliveryLogQuery,
  type DeliveryLogFilters,
} from "../../utils/delivery-log-query";
import { DELIVERY_LOG_PAGE_SIZE_MAX } from "../../types/delivery-log.dto";
import type { DeliveryLogDto } from "../../types/delivery-log.dto";
import { CommunicationNoScopeState } from "../communication-scope-gate";
import { DeliveryLogDetailDrawer } from "./delivery-log-detail-drawer";
import { DeliveryLogTable } from "./delivery-log-table";

/**
 * Delivery Logs Explorer — `GET /communication/delivery-logs`.
 *
 * Server-paginated and server-filtered across all ten documented parameters.
 * Modeled directly on the Audit Explorer, which solves the same
 * toolbar + filters + server pagination + detail-drawer shape.
 */
export function DeliveryLogsScreen() {
  const scope = useCommunicationScope();
  const [filters, setFilters] = useState<DeliveryLogFilters>(
    deliveryLogFilterDefaults(),
  );
  const [selected, setSelected] = useState<DeliveryLogDto | null>(null);

  const debouncedRecipient = useDebouncedValue(filters.recipient, 300);

  const query = useMemo(
    () =>
      scope
        ? toDeliveryLogQuery({ ...filters, recipient: debouncedRecipient }, scope)
        : null,
    [filters, debouncedRecipient, scope],
  );

  const { logs, pagination, isPending, isFetching, error, refetch } =
    useDeliveryLogs(query);

  if (!scope) {
    return (
      <div className="space-y-6">
        <PageHeader title="Delivery Logs" />
        <CommunicationNoScopeState />
      </div>
    );
  }

  const update = (next: Partial<DeliveryLogFilters>) =>
    setFilters((current) => ({ ...current, ...next, page: next.page ?? 1 }));

  const activeFilterCount = countActiveDeliveryLogFilters({
    ...filters,
    recipient: debouncedRecipient,
  });

  const reset = () =>
    setFilters({ ...deliveryLogFilterDefaults(), limit: filters.limit });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Delivery Logs"
        description="Every outbound message attempt for the active organization and branch."
      />

      <div className="space-y-3">
        <DataTableToolbar
          search={filters.recipient}
          onSearchChange={(recipient) => update({ recipient })}
          searchPlaceholder="Search recipient…"
          searchLabel="Search by recipient"
          activeFilterCount={activeFilterCount}
          onClearFilters={reset}
          filters={
            <>
              <Select
                value={filters.channel}
                onValueChange={(channel) => update({ channel })}
              >
                <SelectTrigger className="w-36" aria-label="Filter by channel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNEL_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.status}
                onValueChange={(status) => update({ status })}
              >
                <SelectTrigger className="w-36" aria-label="Filter by status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DELIVERY_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.provider}
                onValueChange={(provider) => update({ provider })}
              >
                <SelectTrigger className="w-36" aria-label="Filter by provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>All providers</SelectItem>
                  {[
                    "SMTP",
                    "AWS_SES",
                    "RESEND",
                    "MAILGUN",
                    "POSTMARK",
                    "TWILIO",
                    "MSG91",
                    "META_WHATSAPP",
                    "FIREBASE_FCM",
                    "CUSTOM",
                  ].map((provider) => (
                    <SelectItem key={provider} value={provider}>
                      {provider.replaceAll("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.datePreset}
                onValueChange={(value) =>
                  update({ datePreset: value as DatePreset })
                }
              >
                <SelectTrigger className="w-40" aria-label="Filter by date range">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_PRESETS.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          }
        />

        <DeliveryLogTable
          logs={logs}
          isLoading={isPending}
          error={error}
          onRetry={() => refetch()}
          onSelect={setSelected}
          emptyState={
            activeFilterCount > 0 ? (
              <EmptyState
                title="No deliveries match those filters"
                description="Try a wider date range, or a different channel, status or provider."
                action={
                  <Button type="button" variant="outline" onClick={reset}>
                    Reset filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={ScrollText}
                title="No deliveries recorded"
                description="Outbound messages will appear here once the platform dispatches one."
              />
            )
          }
        />

        {pagination ? (
          <DataTablePagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            total={pagination.total}
            totalPages={pagination.totalPages}
            isLoading={isFetching}
            onPageChange={(page) => update({ page })}
            onPageSizeChange={(limit) => update({ limit, page: 1 })}
            pageSizeOptions={[10, 25, 50, DELIVERY_LOG_PAGE_SIZE_MAX]}
          />
        ) : null}
      </div>

      <DeliveryLogDetailDrawer
        log={selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}
