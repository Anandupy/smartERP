"use client";

import { SetupCompleteScreen } from "@/features/workspace-setup";

/**
 * `/setup/complete` — reached immediately after `POST /workspace/setup/complete`
 * succeeds. Deliberately outside `setup/(wizard)`'s `RequireSetupIncomplete`
 * guard, so the status flipping to `ready` does not redirect the user away
 * from their own success screen — see `../layout.tsx`.
 */
export default function SetupCompletePage() {
  return <SetupCompleteScreen />;
}
