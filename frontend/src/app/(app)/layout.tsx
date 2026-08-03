import { AppLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/core/auth";
import { RequireWorkspace } from "@/core/workspace";
import { SignOutButton } from "@/features/auth";
import {
  AppFooter,
  AppHeader,
  AppSidebar,
  CommandPalette,
  WorkspaceSwitcher,
} from "@/features/navigation";

/**
 * Layout for the authenticated application route group.
 *
 * Two gates, answering two different questions: `ProtectedRoute` asks whether
 * the visitor is signed in, `RequireWorkspace` asks *where* they are signed in.
 * Every screen inside this group is scoped to an organization, campus and
 * academic year, so rendering one before that scope exists would issue requests
 * with no scope headers on them.
 *
 * This is also where the two features that make up the shell are joined:
 * navigation supplies the chrome, authentication supplies the way out, and
 * neither imports the other — the sign-out control is passed through as a slot,
 * the same arrangement the workspace selection screen uses.
 */
export default function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <RequireWorkspace>
        <AppLayout
          sidebar={<AppSidebar workspaceSwitcher={<WorkspaceSwitcher />} />}
          header={
            <AppHeader
              signOut={
                <SignOutButton className="w-full justify-start" size="sm" />
              }
            />
          }
          footer={<AppFooter />}
        >
          {children}
        </AppLayout>
        <CommandPalette />
      </RequireWorkspace>
    </ProtectedRoute>
  );
}
