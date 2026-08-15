"use client";

import {
  CheckCircle2,
  CircleAlert,
  Mail,
  Send,
  TriangleAlert,
} from "@/assets/icons";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/shared/components/data-display";
import { ApiErrorState, BackendPendingNote } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";
import { formatNumber } from "@/utils";

import { useCommunicationScope } from "../../hooks/use-communication-scope";
import { useDeliveryAnalytics } from "../../hooks/use-delivery-analytics";
import { CommunicationNoScopeState } from "../communication-scope-gate";

function rate(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  // The endpoint's rates may be documented as a 0–1 fraction or a 0–100
  // percentage; both are plausible for "deliveryRate". Normalizing here
  // means the gauge is correct either way without guessing which the
  // backend actually sends.
  return value <= 1 ? value * 100 : value;
}

/**
 * Communication Analytics — `GET /communication/delivery-logs/analytics`.
 *
 * The endpoint's entire documented payload is six counters and three rates —
 * no date range, no channel breakdown, no time series (per
 * `docs/communication-module-ui-spec.md` §9). Every widget below renders only
 * what the response actually carries; nothing is derived beyond the simple
 * arithmetic the counters themselves support.
 */
export function CommunicationAnalyticsScreen() {
  const scope = useCommunicationScope();
  const { analytics, isPending, error, refetch } = useDeliveryAnalytics(scope);

  if (!scope) {
    return (
      <div className="space-y-6">
        <PageHeader title="Communication Analytics" />
        <CommunicationNoScopeState />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Communication Analytics"
        description="Delivery outcomes for the active organization and branch."
      />

      {error ? <ApiErrorState error={error} onRetry={() => refetch()} /> : null}

      {!error ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              icon={Send}
              label="Total"
              value={isPending ? "—" : formatNumber(analytics?.total ?? 0)}
              isLoading={isPending}
            />
            <StatCard
              icon={Mail}
              label="Sent"
              value={isPending ? "—" : formatNumber(analytics?.sent ?? 0)}
              isLoading={isPending}
            />
            <StatCard
              icon={CheckCircle2}
              label="Delivered"
              value={isPending ? "—" : formatNumber(analytics?.delivered ?? 0)}
              isLoading={isPending}
            />
            <StatCard
              icon={TriangleAlert}
              label="Failed"
              value={isPending ? "—" : formatNumber(analytics?.failed ?? 0)}
              isLoading={isPending}
            />
            <StatCard
              icon={CircleAlert}
              label="Bounced"
              value={isPending ? "—" : formatNumber(analytics?.bounced ?? 0)}
              isLoading={isPending}
            />
            <StatCard
              icon={CheckCircle2}
              label="Delivery rate"
              value={
                isPending
                  ? "—"
                  : `${rate(analytics?.metrics?.deliveryRate).toFixed(1)}%`
              }
              isLoading={isPending}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="border-border space-y-2 rounded-xl border p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Failure rate</span>
                <span className="text-muted-foreground">
                  {rate(analytics?.metrics?.failureRate).toFixed(1)}%
                </span>
              </div>
              <Progress value={rate(analytics?.metrics?.failureRate)} />
            </div>
            <div className="border-border space-y-2 rounded-xl border p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Bounce rate</span>
                <span className="text-muted-foreground">
                  {rate(analytics?.metrics?.bounceRate).toFixed(1)}%
                </span>
              </div>
              <Progress value={rate(analytics?.metrics?.bounceRate)} />
            </div>
          </div>

          {!isPending && analytics && (analytics.total ?? 0) > 0 ? (
            <div className="border-border space-y-2 rounded-xl border p-4">
              <p className="text-sm font-medium">Composition</p>
              <div className="bg-muted flex h-3 overflow-hidden rounded-full">
                {(
                  [
                    ["delivered", analytics.delivered, "bg-chart-2"],
                    ["sent", analytics.sent, "bg-chart-3"],
                    ["failed", analytics.failed, "bg-destructive"],
                    ["bounced", analytics.bounced, "bg-chart-4"],
                  ] as const
                ).map(([key, value, className]) => {
                  const total = analytics.total ?? 0;
                  const width = total > 0 ? ((value ?? 0) / total) * 100 : 0;
                  return width > 0 ? (
                    <div
                      key={key}
                      className={className}
                      style={{ width: `${width}%` }}
                      title={`${key}: ${formatNumber(value ?? 0)}`}
                    />
                  ) : null;
                })}
              </div>
            </div>
          ) : null}

          <BackendPendingNote>
            time-series (daily/monthly), per-channel and per-provider
            breakdowns are not available — the analytics endpoint documents
            only these six counters and three rates for the active
            organization/branch, with no date-range or grouping parameter.
          </BackendPendingNote>
        </>
      ) : null}
    </div>
  );
}
