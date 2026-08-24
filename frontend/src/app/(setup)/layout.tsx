"use client";

import { ProtectedRoute } from "@/core/auth";
import { useWorkspaceBootstrap } from "@/features/workspace";

/**
 * Mounts the same identity → availability/setup publishing every workspace
 * route relies on (`useWorkspaceBootstrap`), so every screen under `/setup` —
 * including the completion screen, which needs fresh data right after the
 * transition to `READY` — sees the organization/branch/year created earlier
 * in the same session without a page reload.
 *
 * Deliberately does not also require `"setup-required"` here: `/setup/complete`
 * is reached *because* setup just finished, so it must survive the status
 * changing out from under it. That requirement lives one level down, in
 * `setup/(wizard)/layout.tsx`, which wraps only the steps that still need it.
 * See `docs/workspace-setup-module.md`.
 */
function SetupBootstrapGate({ children }: { children: React.ReactNode }) {
  useWorkspaceBootstrap();
  return <>{children}</>;
}

export default function SetupGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <SetupBootstrapGate>{children}</SetupBootstrapGate>
    </ProtectedRoute>
  );
}
