"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { ROUTES } from "@/constants";
import { usePermissions } from "@/core/auth";
import { useWorkspaceStore } from "@/core/workspace";
import {
  AcademicYearForm,
  academicYearFormDefaults,
  toAcademicYearRequest,
  useAcademicYearBranch,
  useAcademicYears,
  useCreateAcademicYear,
} from "@/features/academic-year";
import { identityKeys } from "@/features/workspace";
import { SetupShell, buildSetupSteps } from "@/features/workspace-setup";
import { EmptyState, ForbiddenState } from "@/shared/components/feedback";

/**
 * `/setup/academic-year` — `SUPER_ADMIN` or `ORG_ADMIN`.
 *
 * Reuses `AcademicYearForm` verbatim. The backend auto-activates and
 * auto-selects a branch's first academic year — `AcademicYearForm` already
 * warns about this — so no extra copy is added here.
 */
export default function SetupAcademicYearPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasRole, roles } = usePermissions();
  const setup = useWorkspaceStore((state) => state.setupStatus);
  const branch = useAcademicYearBranch();
  const { academicYears } = useAcademicYears(branch?.id ?? null);
  const create = useCreateAcademicYear();

  const alreadyDone = setup?.completedResources.includes("ACADEMIC_YEAR") ?? false;

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

  if (!branch) {
    return (
      <SetupShell title="Set your academic year" steps={steps}>
        <EmptyState
          title="Waiting on a branch"
          description="An academic year belongs to a branch — that step needs to finish first."
        />
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
