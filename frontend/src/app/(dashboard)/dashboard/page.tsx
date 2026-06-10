import type { Metadata } from 'next';
import {
  Users,
  UserPlus,
  CalendarDays,
  TrendingUp,
  BarChart3,
  Building2,
  Network,
  BookOpen,
} from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/ui/v1/components/layout/PageHeader';
import { KPITile } from '@/components/shared/KPITile';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Dashboard' };

export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="EduOS operational overview"
        breadcrumbs={[{ label: 'Dashboard' }]}
        actions={
          <Button size="sm" variant="outline">
            <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
            Export Report
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* KPI Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KPITile
            label="Total Students"
            value="—"
            icon={Users}
            color="primary"
          />
          <KPITile
            label="New Admissions"
            value="—"
            icon={UserPlus}
            color="success"
          />
          <KPITile
            label="Active Programs"
            value="—"
            icon={CalendarDays}
            color="info"
          />
          <KPITile
            label="Pending Reviews"
            value="—"
            icon={TrendingUp}
            color="warning"
          />
        </div>

        {/* Quick Actions */}
        <div className="erp-card p-5">
          <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'New Application', href: '/admissions', icon: UserPlus },
              { label: 'Organizations', href: '/administration/organizations', icon: Building2 },
              { label: 'Academic Units', href: '/academic', icon: Network },
              { label: 'Programs', href: '/academic/programs', icon: BookOpen },
            ].map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="flex flex-col items-center gap-2 rounded-lg border border-border bg-background p-4 text-center text-[12px] font-medium text-text-secondary transition-colors hover:border-border-strong hover:bg-surface hover:text-foreground"
              >
                <action.icon className="h-5 w-5 text-text-muted" />
                {action.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Setup reminder */}
        <div className="rounded-lg border border-warning/30 bg-warning-bg p-4">
          <p className="text-[13px] font-medium text-warning">
            Complete your ERP setup to unlock all features
          </p>
          <p className="mt-0.5 text-[12px] text-warning/80">
            Configure Organization → Branch → Academic Year → Programs to get started.
          </p>
          <Link
            href="/settings/general"
            className="mt-2 inline-block text-[12px] font-medium text-warning underline-offset-2 hover:underline"
          >
            Go to Settings →
          </Link>
        </div>
      </div>
    </div>
  );
}
