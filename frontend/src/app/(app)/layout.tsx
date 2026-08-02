import { AppLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/core/auth";
import { RequireWorkspace } from "@/core/workspace";

/**
 * Layout for the authenticated application route group.
 *
 * Two gates, answering two different questions: `ProtectedRoute` asks whether
 * the visitor is signed in, `RequireWorkspace` asks *where* they are signed in.
 * Every screen inside this group is scoped to an organization, campus and
 * academic year, so rendering one before that scope exists would issue requests
 * with no scope headers on them.
 *
 * Sidebar and header slots are injected by the navigation feature later.
 */
export default function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <RequireWorkspace>
        <AppLayout>{children}</AppLayout>
      </RequireWorkspace>
    </ProtectedRoute>
  );
}
