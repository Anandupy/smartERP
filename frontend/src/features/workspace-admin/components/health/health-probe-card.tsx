"use client";

import type { LucideIcon } from "@/assets/icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/shared/components/data-display";
import { Skeleton } from "@/components/ui/skeleton";

import { HEALTH_STATE_PRESENTATION } from "../../constants";

export interface HealthProbeCardProps {
  title: string;
  icon: LucideIcon;
  /** One of `mapHealthStatus`'s return values — see `mappers/health.mapper.ts`. */
  state: string;
  /** Explains what this probe actually checks — the distinction this screen exists to preserve. */
  checks: string;
  httpStatus: number | null;
  latencyMs: number | null;
  checkedAt: string | null;
  errorMessage?: string;
  isLoading?: boolean;
  isFetching?: boolean;
}

/**
 * One probe's status, in operational detail — never just a colored dot.
 *
 * `httpStatus: null` is shown as "no response" rather than as any particular
 * status code, because that is exactly what it means: the request never
 * completed at all (network error, timeout, cancellation).
 */
export function HealthProbeCard({
  title,
  icon: Icon,
  state,
  checks,
  httpStatus,
  latencyMs,
  checkedAt,
  errorMessage,
  isLoading = false,
  isFetching = false,
}: HealthProbeCardProps) {
  const presentation =
    HEALTH_STATE_PRESENTATION[state] ?? HEALTH_STATE_PRESENTATION.unknown!;

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Icon aria-hidden="true" className="text-muted-foreground size-4" />
            {title}
          </span>
          {isLoading ? (
            <Skeleton className="h-5 w-16" />
          ) : (
            <StatusBadge tone={presentation.tone} dot>
              {presentation.label}
            </StatusBadge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        <p className="text-muted-foreground text-xs">{checks}</p>

        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">HTTP status</dt>
            <dd className="text-right tabular-nums">{httpStatus ?? "No response"}</dd>
            <dt className="text-muted-foreground">Response time</dt>
            <dd className="text-right tabular-nums">
              {latencyMs !== null ? `${Math.round(latencyMs)} ms` : "—"}
            </dd>
            <dt className="text-muted-foreground">Last checked</dt>
            <dd className="text-right">
              {checkedAt ? new Date(checkedAt).toLocaleTimeString() : "—"}
            </dd>
          </dl>
        )}

        {errorMessage ? (
          <p className="text-destructive text-xs" role="alert">
            {errorMessage}
          </p>
        ) : null}

        {isFetching && !isLoading ? (
          <p className="text-muted-foreground text-xs">Refreshing…</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
