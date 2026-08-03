"use client";

import Link from "next/link";

import { Blocks, CircleCheckBig, Plus, Power, School } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/constants";
import { StatCard } from "@/shared/components/data-display";
import {
  ApiErrorState,
  BackendPendingNote,
  EmptyState,
} from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";
import { formatNumber } from "@/utils";

import { INSTITUTION_TYPE_PRESENTATION, branchState } from "../constants";
import { useBranches } from "../hooks/use-branches";
import { BranchStatusBadge } from "./branch-status-badge";

export interface BranchDashboardScreenProps {
  /**
   * Recent branch activity, wired at the route.
   *
   * A slot rather than an import: the audit module owns the query and the
   * table. Branch events are recorded under the `ORGANIZATION` audit module,
   * so the trail is real rather than a placeholder.
   */
  activityTrail?: React.ReactNode;
}

/**
 * Branch management overview.
 *
 * The counts are stated carefully. `GET /branches` is documented to return
 * **active** branches, so "Listed" is what the endpoint returned — not a total,
 * and not something an inactive count can be subtracted from. The design's
 * infrastructure-health panel (99.8% uptime, 42ms average latency) has no
 * documented source whatsoever and is declared rather than estimated: an
 * operator acts on a dashboard figure, and one that is quietly wrong is worse
 * than one that is absent.
 */
export function BranchDashboardScreen({
  activityTrail,
}: BranchDashboardScreenProps) {
  const { branches, isPending, error, refetch } = useBranches();

  const active = branches.filter(
    (branch) => branchState(branch) === "active",
  ).length;
  const inactive = branches.filter(
    (branch) => branchState(branch) === "inactive",
  ).length;

  /** How many branches of each documented institution type were returned. */
  const byType = branches.reduce<Record<string, number>>((counts, branch) => {
    const key = branch.institutionType ?? "OTHER";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});

  const recent = branches.slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branch Ecosystem"
        description="Campuses across the platform: their classification, contact details and operating status."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={ROUTES.app.branches.directory}>View directory</Link>
            </Button>
            <Button asChild>
              <Link href={ROUTES.app.branches.create}>
                <Plus />
                New branch
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
              icon={School}
              label="Listed"
              value={isPending ? "—" : formatNumber(branches.length)}
              hint="Returned by the branches endpoint"
              isLoading={isPending}
            />
            <StatCard
              icon={CircleCheckBig}
              label="Active"
              value={isPending ? "—" : formatNumber(active)}
              hint="Reporting an active flag"
              isLoading={isPending}
            />
            <StatCard
              icon={Power}
              label="Inactive"
              value={isPending ? "—" : formatNumber(inactive)}
              hint="Among the branches returned"
              isLoading={isPending}
            />
          </div>

          <BackendPendingNote>
            the endpoint is documented to list active branches only, so a
            platform-wide total and a deleted count cannot be derived from it.
            Uptime, latency and node health have no documented source at all,
            and student, faculty and programme totals belong to modules with no
            branch-scoped endpoint.
          </BackendPendingNote>

          {!isPending && branches.length > 0 ? (
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2">
                  <Blocks aria-hidden="true" className="size-4" />
                  By institution type
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <ul className="flex flex-wrap gap-x-6 gap-y-2">
                  {Object.entries(byType).map(([type, count]) => {
                    const presentation =
                      INSTITUTION_TYPE_PRESENTATION[
                        type as keyof typeof INSTITUTION_TYPE_PRESENTATION
                      ];
                    return (
                      <li
                        key={type}
                        className="flex items-center gap-2 text-sm"
                      >
                        <span className="text-foreground font-semibold">
                          {formatNumber(count)}
                        </span>
                        <span className="text-muted-foreground">
                          {presentation?.label ?? type}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center justify-between gap-2">
                Branches
                <Button asChild variant="ghost" size="sm">
                  <Link href={ROUTES.app.branches.directory}>View all</Link>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {isPending ? (
                <p className="text-muted-foreground text-sm">Loading…</p>
              ) : recent.length === 0 ? (
                <EmptyState
                  icon={School}
                  title="No branches yet"
                  description="Create the first campus to get started."
                  className="min-h-32"
                  action={
                    <Button asChild>
                      <Link href={ROUTES.app.branches.create}>
                        <Plus />
                        Create branch
                      </Link>
                    </Button>
                  }
                />
              ) : (
                <ul className="divide-border divide-y">
                  {recent.map((branch) => (
                    <li key={branch.id}>
                      <Link
                        href={ROUTES.app.branches.detail(branch.id)}
                        className="hover:bg-muted/60 focus-visible:ring-ring -mx-2 flex items-center gap-3 rounded-lg px-2 py-3 focus-visible:ring-3 focus-visible:outline-none"
                      >
                        <span
                          aria-hidden="true"
                          className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold"
                        >
                          {branch.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {branch.name}
                          </span>
                          <span className="text-muted-foreground block truncate text-xs">
                            <code>{branch.code}</code>
                            {branch.city ? ` · ${branch.city}` : ""}
                          </span>
                        </span>
                        <BranchStatusBadge branch={branch} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      {activityTrail ? (
        <section className="space-y-3">
          <h2 className="text-foreground text-sm font-medium">
            Recent branch activity
          </h2>
          {activityTrail}
        </section>
      ) : null}
    </div>
  );
}
