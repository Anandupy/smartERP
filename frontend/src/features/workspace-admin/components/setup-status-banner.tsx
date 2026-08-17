"use client";

import { TriangleAlert } from "@/assets/icons";
import { Banner } from "@/shared/components/feedback";

import { useSetupStatus } from "../hooks/use-setup-status";

export interface SetupStatusBannerProps {
  /** Pass the caller's own role check — the endpoint is SUPER_ADMIN/ORG_ADMIN only. */
  enabled: boolean;
}

/**
 * A small, non-blocking notice when the workspace bootstrap is incomplete.
 *
 * This module ships no setup wizard (`POST /workspace/setup/complete` is
 * unused here — see `docs/workspace-admin-module.md`); this banner exists only
 * so a Super Admin working in navigation administration or the configuration
 * editor is not left wondering why a fresh installation behaves oddly.
 * Renders nothing once setup is complete, while loading, or on any error —
 * this is a courtesy, not a gate.
 */
export function SetupStatusBanner({ enabled }: SetupStatusBannerProps) {
  const { data, isPending, error } = useSetupStatus(enabled);

  if (!enabled || isPending || error || !data?.setupRequired) return null;

  return (
    <Banner
      tone="warning"
      icon={TriangleAlert}
      title="Workspace setup is not complete"
      description={`Current stage: ${data.setupStage}. ${data.missingResources.length > 0 ? `Missing: ${data.missingResources.join(", ")}.` : ""}`}
    />
  );
}
