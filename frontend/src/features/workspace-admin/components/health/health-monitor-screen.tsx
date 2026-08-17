"use client";

import { useState } from "react";

import { Activity, Database, RefreshCw, Server } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DescriptionList,
  StatCard,
  StatusBadge,
} from "@/shared/components/data-display";
import { Banner, BackendPendingNote, Spinner } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";

import { HEALTH_POLL_INTERVAL_MS, HEALTH_STATE_PRESENTATION } from "../../constants";
import {
  useFullHealth,
  useLiveness,
  useReadiness,
  useRefreshHealth,
} from "../../hooks/use-health";
import {
  deriveOverallState,
  formatUptime,
  mapHealthStatus,
} from "../../mappers/health.mapper";
import type { HealthCheckResultDto, LivenessDto } from "../../types/health.dto";
import { DependencyTable } from "./dependency-table";
import { HealthProbeCard } from "./health-probe-card";

/**
 * System Health Monitor — S12.
 *
 * The three probes are called **independently**, never combined into one
 * request, so a failing `/health` never prevents `/live` and `/ready` from
 * rendering their own true state (`§32` of the module brief). Each card's
 * `state` comes from the single `mapHealthStatus` function — nothing here
 * compares a status code or a string directly.
 */
export function HealthMonitorScreen() {
  const live = useLiveness();
  const ready = useReadiness();
  const health = useFullHealth();
  const refreshAll = useRefreshHealth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const liveState = mapHealthStatus("live", live.data?.outcome ?? { httpOk: false, httpStatus: null });
  const readyState = mapHealthStatus("ready", ready.data?.outcome ?? { httpOk: false, httpStatus: null });
  const healthState = mapHealthStatus("health", health.data?.outcome ?? { httpOk: false, httpStatus: null });
  const overall = deriveOverallState(liveState, readyState, healthState);
  const overallPresentation = HEALTH_STATE_PRESENTATION[overall]!;

  const isLoading = live.isPending || ready.isPending || health.isPending;
  const uptimeSeconds = (live.data?.outcome.data as LivenessDto | undefined)
    ?.uptimeSeconds;
  const healthDetails =
    (health.data?.outcome.data as HealthCheckResultDto | undefined)?.details ??
    null;

  const mostRecentCheck = [live.data?.checkedAt, ready.data?.checkedAt, health.data?.checkedAt]
    .filter(Boolean)
    .sort()
    .at(-1);
  const slowestLatency = Math.max(
    live.data?.latencyMs ?? 0,
    ready.data?.latencyMs ?? 0,
    health.data?.latencyMs ?? 0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Health Monitor"
        description="Three independent probes — process, traffic and dependencies never share one status."
        badge={
          <StatusBadge tone={overallPresentation.tone} dot>
            {overallPresentation.label}
          </StatusBadge>
        }
        actions={
          <Button
            variant="outline"
            disabled={isRefreshing}
            onClick={async () => {
              setIsRefreshing(true);
              await refreshAll();
              setIsRefreshing(false);
            }}
          >
            {isRefreshing ? <Spinner size="sm" /> : <RefreshCw />}
            Refresh
          </Button>
        }
      />

      {overall === "unknown" ? (
        <Banner
          tone="warning"
          title="Unable to reach the health endpoints"
          description="No response was received from /live, /ready or /health. This says nothing about the database or any specific subsystem — only that this browser could not reach the API at all."
        />
      ) : null}

      <Card>
        <CardHeader className="border-b">
          <CardTitle>System summary</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <DescriptionList
            columns={3}
            items={[
              {
                key: "checked",
                label: "Last checked",
                value: mostRecentCheck
                  ? new Date(mostRecentCheck).toLocaleTimeString()
                  : "—",
              },
              {
                key: "latency",
                label: "Response time (slowest probe)",
                value: `${Math.round(slowestLatency)} ms`,
              },
              {
                key: "uptime",
                label: "Process uptime",
                value: uptimeSeconds !== undefined ? formatUptime(uptimeSeconds) : "—",
              },
              {
                key: "auto",
                label: "Auto-refresh",
                value: `Every ${HEALTH_POLL_INTERVAL_MS / 1000}s`,
              },
              {
                key: "requestId",
                label: "Last request id",
                value: health.data?.error?.requestId ?? "—",
              },
              {
                key: "timestamp",
                label: "Last response timestamp",
                value: health.data?.checkedAt ?? "—",
              },
            ]}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <HealthProbeCard
          title="Application"
          icon={Activity}
          state={liveState}
          checks="Is the process running? Checks no dependencies."
          httpStatus={live.data?.outcome.httpStatus ?? null}
          latencyMs={live.data?.latencyMs ?? null}
          checkedAt={live.data?.checkedAt ?? null}
          errorMessage={
            live.data && !live.data.outcome.httpOk
              ? live.data.outcome.httpStatus === null
                ? "Unable to reach the health endpoint."
                : "Application process is not responding."
              : undefined
          }
          isLoading={live.isPending}
          isFetching={live.isFetching}
        />
        <HealthProbeCard
          title="Traffic"
          icon={Server}
          state={readyState}
          checks="Can this instance serve traffic? Fails while the database is unreachable."
          httpStatus={ready.data?.outcome.httpStatus ?? null}
          latencyMs={ready.data?.latencyMs ?? null}
          checkedAt={ready.data?.checkedAt ?? null}
          errorMessage={
            ready.data && !ready.data.outcome.httpOk
              ? ready.data.outcome.httpStatus === null
                ? "Unable to reach the health endpoint."
                : "Instance is not ready to serve traffic."
              : undefined
          }
          isLoading={ready.isPending}
          isFetching={ready.isFetching}
        />
        <HealthProbeCard
          title="Dependencies"
          icon={Database}
          state={healthState}
          checks="Are dependencies healthy? Checks database and memory."
          httpStatus={health.data?.outcome.httpStatus ?? null}
          latencyMs={health.data?.latencyMs ?? null}
          checkedAt={health.data?.checkedAt ?? null}
          errorMessage={
            health.data && !health.data.outcome.httpOk
              ? health.data.outcome.httpStatus === null
                ? "Unable to reach the health endpoint."
                : "One or more system dependencies are unavailable."
              : undefined
          }
          isLoading={health.isPending}
          isFetching={health.isFetching}
        />
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Dependencies</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <DependencyTable details={healthDetails} />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Application" value={overallPresentation.label} isLoading={isLoading} />
        <StatCard
          label="Slowest response"
          value={`${Math.round(slowestLatency)} ms`}
          hint="Measured in this browser — not backend execution time"
          isLoading={isLoading}
        />
        <StatCard
          label="Process uptime"
          value={uptimeSeconds !== undefined ? formatUptime(uptimeSeconds) : "—"}
          isLoading={isLoading}
        />
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Historical monitoring</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <BackendPendingNote>
            historical uptime, incident timelines and response-time trends need
            a metrics endpoint, which does not exist — `/live`, `/ready` and
            `/health` are current-state probes only. This screen shows what was
            actually observed on each refresh and nothing invented.
          </BackendPendingNote>
        </CardContent>
      </Card>
    </div>
  );
}
