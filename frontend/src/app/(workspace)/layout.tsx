import { ProtectedRoute } from "@/core/auth";

/**
 * Layout for the workspace-selection route group.
 *
 * `ProtectedRoute` only — choosing a scope requires a session but not a scope,
 * so this group deliberately sits outside `RequireWorkspace`. Guarding it with
 * the workspace gate would send the screen that resolves the scope to itself.
 *
 * No shell is imposed: the screen picks its own (a split brand layout), the
 * same way the auth group works.
 */
export default function WorkspaceGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
