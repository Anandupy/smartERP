import type { Metadata } from 'next';
import { AuthGuard } from '@/core/guards/auth-guard';
import { AppShell } from '@/components/layout/app-shell';
import { CommandMenu } from '@/components/shared/command-menu';

export const metadata: Metadata = {
  title: {
    template: '%s | EduOS',
    default: 'Dashboard | EduOS',
  },
};

interface DashboardLayoutProps {
  children: React.ReactNode;
}

/**
 * Dashboard layout — wraps all protected ERP routes.
 *
 * Provider order (inner-most here, outer providers in root layout):
 * AuthGuard → AppShell → CommandMenu
 *
 * AuthGuard handles client-side auth verification.
 * AppShell renders Sidebar + TopBar + ContextBar + content area.
 * CommandMenu provides global CMD+K search (rendered at layout level
 * so it persists across page navigations).
 */
export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <AuthGuard>
      <AppShell>
        {children}
        <CommandMenu />
      </AppShell>
    </AuthGuard>
  );
}
