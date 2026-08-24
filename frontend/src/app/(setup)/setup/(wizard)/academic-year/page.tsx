"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { Building2 } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ROUTES } from "@/constants";
import { usePermissions } from "@/core/auth";
import { useWorkspace, useWorkspaceStore } from "@/core/workspace";
import {
  AcademicYearForm,
  academicYearFormDefaults,
  toAcademicYearRequest,
  useAcademicYears,
  useCreateAcademicYear,
} from "@/features/academic-year";
import { identityKeys } from "@/features/workspace";
import { WorkspaceSelectField } from "@/features/workspace";
import { SetupShell, buildSetupSteps } from "@/features/workspace-setup";
import { EmptyState, ForbiddenState } from "@/shared/components/feedback";

/**
 * `/setup/academic-year` — `SUPER_ADMIN` or `ORG_ADMIN`.
 *
 * Reuses `AcademicYearForm` verbatim. The owning branch comes from
 * `useWorkspace()` directly — **not** `useAcademicYearBranch()`, which gates
 * on `isReady` (`status === "ready"`). Setup never reaches `"ready"`; it stays
 * `"setup-required"` throughout by design (`core/workspace` never calls
 * `confirm()` during setup — see `docs/workspace-setup-module.md`). That
 * mismatch, not a stale query, was why this screen used to show "Waiting on a
 * branch" even after the stepper marked Branch complete: the hook it read
 * from is written for the confirmed post-setup scope, which setup never
 * enters. `useWorkspace().branch` carries no such gate — it is derived
 * straight from the current selection, which `narrowSelection` already
 * auto-settles onto the sole branch the moment `/auth/me` reports one (see
 * `workspace-store.ts`), the same mechanism the Branch/Organization steps
 * already relied on. When more than one branch exists, `branch` stays `null`
 * until the picker below calls `select()` — a real choice, not an invented
 * default.
 *
 * The backend auto-activates and auto-selects a branch's first academic
 * year — `AcademicYearForm` already warns about this — so no extra copy is
 * added here.
 */
export default function SetupAcademicYearPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasRole, roles } = usePermissions();
  const setup = useWorkspaceStore((state) => state.setupStatus);
  const { branch, options, select } = useWorkspace();
  const { academicYears } = useAcademicYears(branch?.id ?? null);
  const create = useCreateAcademicYear();

  const alreadyDone =
    setup?.completedResources.includes("ACADEMIC_YEAR") ?? false;

  useEffect(() => {
    if (alreadyDone) router.replace(ROUTES.setup.root);
  }, [alreadyDone, router]);

  if (!hasRole("SUPER_ADMIN") && !hasRole("ORG_ADMIN")) {
    return (
      <ForbiddenState description="Creating an academic year requires Super Admin or Org Admin." />
    );
  }

  if (alreadyDone) return null;

  const steps = setup ? buildSetupSteps(setup, roles[0] ?? null) : undefined;

  if (options.branches.length === 0) {
    return (
      <SetupShell title="Set your academic year" steps={steps}>
        <EmptyState
          title="Add a branch first"
          description="An academic year belongs to a branch — create one before continuing."
          action={
            <Button onClick={() => router.push(ROUTES.setup.branch)}>
              Go to Branch
            </Button>
          }
        />
      </SetupShell>
    );
  }

  if (!branch) {
    return (
      <SetupShell
        title="Set your academic year"
        description="Which branch is this academic year for?"
        steps={steps}
      >
        <Card>
          <CardContent className="pt-6">
            <WorkspaceSelectField
              id="setup-academic-year-branch"
              label="Branch"
              icon={Building2}
              placeholder="Select a branch"
              emptyPlaceholder="No branches yet"
              value={null}
              options={options.branches}
              onChange={(branchId) => select({ branchId })}
            />
          </CardContent>
        </Card>
      </SetupShell>
    );
  }

  return (
    <SetupShell
      title="Set your academic year"
      description={`Academic year for ${branch.name}.`}
      steps={steps}
    >
      <AcademicYearForm
        defaultValues={academicYearFormDefaults(branch.id)}
        branchName={branch.name}
        existingYears={academicYears}
        submitLabel="Create and continue"
        onCancel={() => router.push(ROUTES.setup.root)}
        onSubmit={async (values) => {
          await create.mutateAsync(toAcademicYearRequest(values));
          await queryClient.invalidateQueries({ queryKey: identityKeys.all });
          router.push(ROUTES.setup.root);
        }}
      />
    </SetupShell>
  );
}
