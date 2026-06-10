import type { Metadata } from 'next';
import { AuthGuard } from '@/core/guards/auth-guard';
import { AppShell } from '@/ui/v1/components/layout/AppShell';
import { CommandMenu } from '@/components/shared/command-menu';

export const metadata: Metadata = {
  title: {
    template: '%s | EduOS',
    default: 'EduOS',
  },
};

/**
 * Authenticated app layout — wraps all protected ERP routes.
 *
 * Uses UI v1 AppShell (Sidebar + TopBar + ContextBar).
 * To switch UI versions: change the AppShell import to '@/ui/v2/...'
 * Routes never change — only the UI implementation.
 *
 * Provider chain: AuthGuard → AppShell → CommandMenu
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppShell>
        {children}
        <CommandMenu />
      </AppShell>
    </AuthGuard>
  );
}
