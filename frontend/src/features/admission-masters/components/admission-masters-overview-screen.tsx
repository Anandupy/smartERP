"use client";

import { useQueries } from "@tanstack/react-query";
import Link from "next/link";

import { CircleCheckBig, Layers, Power } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ROUTES } from "@/constants";
import { StatCard } from "@/shared/components/data-display";
import { EmptyState } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";
import { formatNumber } from "@/utils";

import {
  ADMISSION_MASTER_TYPES,
  admissionMasterConfig,
} from "../config/admission-master-registry";
import { admissionMasterClient } from "../api/admission-master-clients";
import { useAdmissionMastersBranch } from "../hooks/use-admission-masters";

/**
 * The Admission Masters hub.
 *
 * Cards link to each of the 10 resources' directories — this grid *is* the
 * navigation into the module, rather than duplicating the same 10 links in a
 * sidebar submenu.
 *
 * Summary tiles use only real, requested data. "Total masters" is the literal
 * size of the registry (10) — a fixed fact, not a fabricated figure. "Active"
 * and "Inactive" are summed from 10 parallel `includeInactive=true` list
 * calls, one per resource. There is no "Backend Connected" tile: it would map
 * to no real signal, which is exactly the kind of indicator the module avoids
 * inventing everywhere else.
 */
export function AdmissionMastersOverviewScreen() {
  const branch = useAdmissionMastersBranch();

  const results = useQueries({
    queries: ADMISSION_MASTER_TYPES.map((type) => {
      const { service, keys } = admissionMasterClient(type);
      return {
        queryKey: keys.list({ branchId: branch?.id ?? "" }),
        queryFn: () => service.list(true),
        enabled: Boolean(branch),
        meta: { skipErrorToast: true },
      };
    }),
  });

  const isLoading = Boolean(branch) && results.some((result) => result.isPending);
  const allRecords = results.flatMap((result) => result.data ?? []);
  const active = allRecords.filter((record) => record.isActive).length;
  const inactive = allRecords.length - active;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admission Masters"
        description="Configure the reference data used throughout the admission and applicant workflows."
      />

      {!branch ? (
        <EmptyState
          icon={Layers}
          title="No active branch"
          description="Every admission master is scoped to a branch. Choose a branch to see its reference data."
          action={
            <Button asChild variant="outline">
              <Link href={ROUTES.workspace.root}>Change workspace</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              icon={Layers}
              label="Total masters"
              value={String(ADMISSION_MASTER_TYPES.length)}
              hint="Reference-data resources in this area"
            />
            <StatCard
              icon={CircleCheckBig}
              label="Active records"
              value={isLoading ? "—" : formatNumber(active)}
              hint="Across all 10 masters"
              isLoading={isLoading}
            />
            <StatCard
              icon={Power}
              label="Inactive records"
              value={isLoading ? "—" : formatNumber(inactive)}
              hint="Across all 10 masters"
              isLoading={isLoading}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ADMISSION_MASTER_TYPES.map((type) => {
              const config = admissionMasterConfig(type);
              const Icon = config.icon;

              return (
                <Link key={type} href={ROUTES.app.admissionMasters.list(config.resource)}>
                  <Card className="hover:border-primary/50 h-full transition-colors">
                    <CardContent className="flex items-start gap-3 pt-6">
                      <span
                        aria-hidden="true"
                        className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg"
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="text-foreground block truncate text-sm font-medium">
                          {config.pluralLabel}
                        </span>
                        <span className="text-muted-foreground line-clamp-2 block text-xs">
                          {config.description}
                        </span>
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
