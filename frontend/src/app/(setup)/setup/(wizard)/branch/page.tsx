"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { ROUTES } from "@/constants";
import { usePermissions } from "@/core/auth";
import { useWorkspace, useWorkspaceStore } from "@/core/workspace";
import {
  BranchForm,
  branchFormDefaults,
  toBranchRequest,
  useCreateBranch,
} from "@/features/branch";
import { identityKeys } from "@/features/workspace";
import { SetupShell, buildSetupSteps } from "@/features/workspace-setup";
import { EmptyState, ForbiddenState } from "@/shared/components/feedback";

/**
 * `/setup/branch` — `SUPER_ADMIN` or `ORG_ADMIN`.
 *
 * Reuses `BranchForm` verbatim, including its own `useWorkspace()` call for
 * the organization picker — which resolves correctly here because the setup
 * layout mounts `useWorkspaceBootstrap()` the same way `/workspace` does, and
 * the store auto-settles the sole organization during setup (see
 * `workspace-store.ts`).
 */
export default function SetupBranchPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasRole, roles } = usePermissions();
  const setup = useWorkspaceStore((state) => state.setupStatus);
  const { organization } = useWorkspace();
  const create = useCreateBranch();

  const alreadyDone = setup?.completedResources.includes("BRANCH") ?? false;

  useEffect(() => {
    if (alreadyDone) router.replace(ROUTES.setup.root);
  }, [alreadyDone, router]);

  if (!hasRole("SUPER_ADMIN") && !hasRole("ORG_ADMIN")) {
    return (
      <ForbiddenState description="Creating a branch requires Super Admin or Org Admin." />
    );
  }

  if (alreadyDone) return null;

  const steps = setup ? buildSetupSteps(setup, roles[0] ?? null) : undefined;

  if (!organization) {
    return (
      <SetupShell title="Add your first branch" steps={steps}>
        <EmptyState
          title="Waiting on the organization"
          description="A branch belongs to an organization — that step needs to finish first."
        />
      </SetupShell>
    );
  }

  return (
    <SetupShell
      title="Add your first branch"
      description={`This will be ${organization.name}'s first campus. You can add more later.`}
      steps={steps}
    >
      <BranchForm
        defaultValues={branchFormDefaults(organization.id)}
        submitLabel="Create and continue"
        onCancel={() => router.push(ROUTES.setup.root)}
        onSubmit={async (values) => {
          await create.mutateAsync(toBranchRequest(values));
          await queryClient.invalidateQueries({ queryKey: identityKeys.all });
          router.push(ROUTES.setup.root);
        }}
      />
    </SetupShell>
  );
}
