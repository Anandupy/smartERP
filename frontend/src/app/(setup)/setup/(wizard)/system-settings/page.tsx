"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { ROUTES } from "@/constants";
import { usePermissions } from "@/core/auth";
import { useWorkspaceStore } from "@/core/workspace";
import { InitializeSettingsForm } from "@/features/system-settings";
import { identityKeys } from "@/features/workspace";
import { SetupShell, buildSetupSteps } from "@/features/workspace-setup";
import { ForbiddenState } from "@/shared/components/feedback";

/**
 * `/setup/system-settings` — `SUPER_ADMIN` only.
 *
 * Route composition: wires the System Settings feature's existing
 * initialization form into the wizard's shell, and — since this feature's own
 * mutation only updates its own cache — invalidates identity afterward so the
 * wizard's progress (read from `/auth/me` via `core/workspace`) reflects the
 * new state immediately. `ORG_ADMIN` never reaches this screen through the
 * wizard's own navigation, but the guard here is what actually stops a direct
 * URL visit — `docs/workspace-setup-module.md`.
 */
export default function SetupSystemSettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasRole, roles } = usePermissions();
  const setup = useWorkspaceStore((state) => state.setupStatus);

  if (!hasRole("SUPER_ADMIN")) {
    return (
      <ForbiddenState description="Platform initialization is Super Admin only." />
    );
  }

  return (
    <SetupShell
      title="System settings"
      description="This establishes the installation's product identity and can only be done once."
      steps={setup ? buildSetupSteps(setup, roles[0] ?? null) : undefined}
    >
      <InitializeSettingsForm
        submitLabel="Save and continue"
        onSubmitted={() => {
          void queryClient.invalidateQueries({ queryKey: identityKeys.all });
          router.push(ROUTES.setup.root);
        }}
      />
    </SetupShell>
  );
}
