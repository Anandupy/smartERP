"use client";

import { LogOut } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/core/auth";
import { useLogout } from "@/features/auth";
import { SetupWelcomeScreen } from "@/features/workspace-setup";

/**
 * `/setup` — the wizard's entry point.
 *
 * A route composition file: it wires the feature-agnostic
 * `SetupWelcomeScreen` to the one action it does not own (signing out),
 * mirroring `academic-units/program-composition.tsx`'s two-features-meet-
 * at-the-route pattern.
 */
export default function SetupPage() {
  const { roles } = usePermissions();
  const logout = useLogout();

  return (
    <SetupWelcomeScreen
      role={roles[0] ?? null}
      headerActions={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => logout.mutate(undefined)}
        >
          <LogOut aria-hidden="true" />
          Sign out
        </Button>
      }
    />
  );
}
