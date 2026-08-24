"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { ROUTES } from "@/constants";
import { usePermissions } from "@/core/auth";
import { identityKeys } from "@/features/workspace";
import { SetupReviewScreen } from "@/features/workspace-setup";

/**
 * `/setup/review` — the last stop before `POST /workspace/setup/complete`.
 *
 * After completion succeeds, identity is invalidated so the rest of the app
 * (including this same route group's guard) learns the workspace is `READY`
 * before navigating to the completion screen.
 */
export default function SetupReviewPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { roles } = usePermissions();

  return (
    <SetupReviewScreen
      role={roles[0] ?? null}
      onCompleted={() => {
        void queryClient.invalidateQueries({ queryKey: identityKeys.all });
        router.push(ROUTES.setup.complete);
      }}
    />
  );
}
