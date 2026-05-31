import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { LayoutDashboard } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Dashboard',
};

/**
 * Dashboard page — role-adaptive home screen.
 * Business widgets will be added in Phase 2 (dashboard module).
 * This is the foundation shell only.
 */
export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Welcome to EduOS — your educational management platform."
      />

      {/* Foundation placeholder — Dashboard module built in Phase 2 */}
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-2 text-muted-erp">
          <LayoutDashboard className="h-6 w-6" aria-hidden />
        </div>
        <h2 className="mt-4 text-base font-semibold text-foreground">
          Dashboard widgets coming soon
        </h2>
        <p className="mt-1.5 max-w-xs text-sm text-muted-erp">
          KPIs, admission funnel, recent activity, and quick actions will appear here in Phase 2.
        </p>
      </div>
    </div>
  );
}
