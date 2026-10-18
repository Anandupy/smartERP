"use client";

import Link from "next/link";

import {
  Building2,
  CircleCheckBig,
  Clock,
  Plus,
  TriangleAlert,
} from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/constants";
import { GuideHelpTrigger } from "@/core/guides";
import { StatCard } from "@/shared/components/data-display";
import {
  ApiErrorState,
  BackendPendingNote,
  EmptyState,
} from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";
import { formatNumber } from "@/utils";

import { useOrganizations } from "../hooks/use-organizations";
import {
  EXPIRY_WARNING_DAYS,
  expiryState,
} from "../utils/organization-lifecycle";
import { OrganizationStatusBadge } from "./organization-status-badge";

export interface OrganizationDashboardScreenProps {
  /**
   * Recent organization activity, wired at the route.
   *
   * A slot rather than an import: the audit module owns the query and the
   * table, and the dashboard only decides that recent activity belongs here.
   * The audit contract records organization events under the `ORGANIZATION`
   * module, so the trail is real rather than a placeholder.
   */
  activityTrail?: React.ReactNode;
}

/**
 * Organization management overview.
 *
 * The counts are stated carefully. `GET /organizations` is documented to
 * return **active** organizations, so "Listed" is what the endpoint returned —
 * not a total, and not something to subtract an inactive count from. The
 * design's "Inactive" tile and its uptime/health percentage have no contract
 * behind them at all, and are declared rather than estimated: a dashboard
 * figure is acted on, and one that is quietly wrong is worse than one that is
 * absent.
 */
export function OrganizationDashboardScreen({
  activityTrail,
}: OrganizationDashboardScreenProps) {
  const { organizations, isPending, error, refetch } = useOrganizations();

  const active = organizations.filter(
    (organization) => organization.status === "ACTIVE",
  ).length;
  const expiringSoon = organizations.filter((organization) => {
    const state = expiryState(organization.masterExpiryDate);
    return state === "expiring" || state === "expired";
  }).length;

  const recent = organizations.slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organization Management"
        description="Tenants on the platform: their identity, subscription and status."
        actions={
          <>
            <GuideHelpTrigger guideId="organizations" />
            <Button asChild variant="outline">
              <Link href={ROUTES.app.organizations.directory}>
                View directory
              </Link>
            </Button>
            <Button asChild data-guide="organization-dashboard-create-link">
              <Link href={ROUTES.app.organizations.create}>
                <Plus />
                New organization
              </Link>
            </Button>
          </>
        }
      />

      {error ? <ApiErrorState error={error} onRetry={() => refetch()} /> : null}

      {!error ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              icon={Building2}
              label="Listed"
              value={isPending ? "—" : formatNumber(organizations.length)}
              hint="Returned by the organizations endpoint"
              isLoading={isPending}
            />
            <StatCard
              icon={CircleCheckBig}
              label="Active"
              value={isPending ? "—" : formatNumber(active)}
              hint="Reporting an ACTIVE status"
              isLoading={isPending}
            />
            <StatCard
              icon={Clock}
              label="Expiring or expired"
              value={isPending ? "—" : formatNumber(expiringSoon)}
              hint={`By master expiry date, within ${EXPIRY_WARNING_DAYS} days`}
              isLoading={isPending}
            />
          </div>

          <BackendPendingNote>
            the list returns active and suspended organizations but excludes
            deactivated ones, so a platform-wide total and an inactive count
            cannot be derived from it. Uptime and health figures have no
            documented source at all.
          </BackendPendingNote>

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center justify-between gap-2">
                Organizations
                <Button asChild variant="ghost" size="sm">
                  <Link href={ROUTES.app.organizations.directory}>
                    View all
                  </Link>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {isPending ? (
                <p className="text-muted-foreground text-sm">Loading…</p>
              ) : recent.length === 0 ? (
                <EmptyState
                  icon={Building2}
                  title="No organizations found"
                  description="Your institutional directory is currently empty."
                  className="min-h-32"
                  action={
                    <Button asChild>
                      <Link href={ROUTES.app.organizations.create}>
                        <Plus />
                        Create organization
                      </Link>
                    </Button>
                  }
                />
              ) : (
                <ul className="divide-border divide-y">
                  {recent.map((organization) => (
                    <li key={organization.id}>
                      <Link
                        href={ROUTES.app.organizations.detail(organization.id)}
                        className="hover:bg-muted/60 focus-visible:ring-ring -mx-2 flex items-center gap-3 rounded-lg px-2 py-3 focus-visible:ring-3 focus-visible:outline-none"
                      >
                        <span
                          aria-hidden="true"
                          className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold"
                        >
                          {organization.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {organization.name}
                          </span>
                          <span className="text-muted-foreground block truncate text-xs">
                            <code>{organization.code}</code>
                            {organization.city ? ` · ${organization.city}` : ""}
                          </span>
                        </span>
                        <OrganizationStatusBadge status={organization.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {expiringSoon > 0 ? (
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2">
                  <TriangleAlert
                    aria-hidden="true"
                    className="text-chart-4 size-4"
                  />
                  Subscriptions needing attention
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <ul className="space-y-2">
                  {organizations
                    .filter((organization) => {
                      const state = expiryState(organization.masterExpiryDate);
                      return state === "expiring" || state === "expired";
                    })
                    .map((organization) => (
                      <li
                        key={organization.id}
                        className="flex flex-wrap items-center justify-between gap-2 text-sm"
                      >
                        <Link
                          href={ROUTES.app.organizations.detail(
                            organization.id,
                          )}
                          className="hover:underline"
                        >
                          {organization.name}
                        </Link>
                        <span className="text-muted-foreground">
                          expires {organization.masterExpiryDate}
                        </span>
                      </li>
                    ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}

      {activityTrail ? (
        <section className="space-y-3">
          <h2 className="text-foreground text-sm font-medium">
            Recent organization activity
          </h2>
          {activityTrail}
        </section>
      ) : null}
    </div>
  );
}
