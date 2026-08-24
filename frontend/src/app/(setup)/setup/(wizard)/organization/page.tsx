"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { ROUTES } from "@/constants";
import { usePermissions } from "@/core/auth";
import { useWorkspaceStore } from "@/core/workspace";
import {
  OrganizationForm,
  organizationFormDefaults,
  toOrganizationRequest,
  useCreateOrganization,
} from "@/features/organization";
import { identityKeys } from "@/features/workspace";
import { SetupShell, buildSetupSteps } from "@/features/workspace-setup";
import { ForbiddenState } from "@/shared/components/feedback";

/**
 * `/setup/organization` — `SUPER_ADMIN` only.
 *
 * Reuses `OrganizationForm` verbatim (same schema, same validation, same
 * mapper) — the wizard supplies only the surrounding chrome and what happens
 * after a successful create. Organization creation stays `SUPER_ADMIN`-only
 * even for a delegated (Path B) setup: `docs/workspace-setup-module.md` §8
 * documents why this does not follow the ORG_ADMIN-can-create-everything
 * reading a first glance at the task might suggest.
 */
export default function SetupOrganizationPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasRole, roles } = usePermissions();
  const setup = useWorkspaceStore((state) => state.setupStatus);
  const create = useCreateOrganization();

  const alreadyDone = setup?.completedResources.includes("ORGANIZATION") ?? false;

  useEffect(() => {
    if (alreadyDone) router.replace(ROUTES.setup.root);
  }, [alreadyDone, router]);

  if (!hasRole("SUPER_ADMIN")) {
    return (
      <ForbiddenState description="Creating the organization is Super Admin only." />
    );
  }

  if (alreadyDone) return null;

  return (
    <SetupShell
      title="Create your organization"
      description="This is your institution's top-level record. Branches and academic years belong to it."
      steps={setup ? buildSetupSteps(setup, roles[0] ?? null) : undefined}
    >
      <OrganizationForm
        defaultValues={organizationFormDefaults()}
        submitLabel="Create and continue"
        onCancel={() => router.push(ROUTES.setup.root)}
        onSubmit={async (values) => {
          await create.mutateAsync(toOrganizationRequest(values));
          await queryClient.invalidateQueries({ queryKey: identityKeys.all });
          router.push(ROUTES.setup.root);
        }}
      />
    </SetupShell>
  );
}
