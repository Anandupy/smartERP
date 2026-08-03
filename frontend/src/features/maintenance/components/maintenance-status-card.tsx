"use client";

import { CircleCheckBig, RefreshCw, Wrench } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/shared/components/data-display";
import { BackendPendingNote, InlineError } from "@/shared/components/feedback";

import { SCOPE_PRESENTATION } from "../constants";
import { useActiveMaintenanceStatus } from "../hooks/use-maintenance-rules";
import { MaintenanceBanner } from "./maintenance-banner";

/**
 * What the platform believes about *this* caller's availability right now.
 *
 * The value comes from `GET /maintenance-rules/active/status`, which resolves
 * the winning rule from the request's own scope headers — so this card answers
 * "is my campus under maintenance", not "does any rule exist". That is the
 * question an operator actually has after saving one.
 *
 * The endpoint's response body is undocumented, so an unreadable payload is
 * reported as pending rather than silently treated as "all clear": telling
 * someone the system is fine on the strength of a payload nothing could parse
 * is the one failure mode worth being loud about.
 */
export function MaintenanceStatusCard() {
  const { status, isPending, error, refetch, isFetching } =
    useActiveMaintenanceStatus();

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Wrench aria-hidden="true" className="size-4" />
          Current status
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Re-check status"
            className="ml-auto"
            disabled={isFetching}
            onClick={() => refetch()}
          >
            <RefreshCw />
          </Button>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3 pt-4">
        {isPending ? <Skeleton className="h-16 w-full rounded-xl" /> : null}

        {error ? <InlineError error={error} /> : null}

        {status?.isUnderMaintenance ? (
          <MaintenanceBanner
            title={status.title}
            message={status.message}
            scopeLabel={
              status.scopeType
                ? SCOPE_PRESENTATION[status.scopeType].label
                : null
            }
            detailsHref={status.customPage}
          />
        ) : null}

        {status && !status.isUnderMaintenance && !status.isUnrecognized ? (
          <div className="flex items-center gap-2">
            <StatusBadge tone="success" icon={CircleCheckBig}>
              Operating normally
            </StatusBadge>
            <span className="text-muted-foreground text-sm">
              No maintenance rule applies to your current scope.
            </span>
          </div>
        ) : null}

        {status?.isUnrecognized ? (
          <BackendPendingNote>
            the status endpoint answered with a shape this app does not
            recognize. Its response body is not documented, so no maintenance
            state can be reported from it.
          </BackendPendingNote>
        ) : null}
      </CardContent>
    </Card>
  );
}
