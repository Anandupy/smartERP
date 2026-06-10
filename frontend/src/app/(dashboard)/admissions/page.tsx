import type { Metadata } from 'next';
import { UserPlus, KanbanSquare, Table2, SlidersHorizontal } from 'lucide-react';
import { PageHeader } from '@/ui/v1/components/layout/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Admissions' };

export default function AdmissionsPage() {
  return (
    <div className="flex flex-col">
      <PageHeader
        title="Admissions Pipeline"
        description="Manage applicant intake and workflow"
        breadcrumbs={[{ label: 'Admissions' }]}
        actions={
          <>
            <Button size="sm" variant="outline">
              <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
              Filters
            </Button>
            <Button size="sm" variant="outline">
              <Table2 className="mr-1.5 h-3.5 w-3.5" />
              Table
            </Button>
            <Button size="sm" variant="outline">
              <KanbanSquare className="mr-1.5 h-3.5 w-3.5" />
              Kanban
            </Button>
            <Button size="sm" asChild>
              <Link href="/admissions/new">
                <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                New Application
              </Link>
            </Button>
          </>
        }
      />

      {/* Status counter tiles */}
      <div className="flex flex-wrap gap-2 border-b border-border bg-background px-6 py-3">
        {[
          { label: 'Draft', color: 'bg-surface-2 text-text-secondary' },
          { label: 'Submitted', color: 'bg-info-bg text-info' },
          { label: 'Under Review', color: 'bg-warning-bg text-warning' },
          { label: 'Doc Pending', color: 'bg-warning-bg text-warning' },
          { label: 'Fee Pending', color: 'bg-warning-bg text-warning' },
          { label: 'Approved', color: 'bg-success-bg text-success' },
        ].map((s) => (
          <div
            key={s.label}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium ${s.color}`}
          >
            {s.label}
            <span className="font-bold">—</span>
          </div>
        ))}
      </div>

      <div className="p-6">
        <EmptyState
          icon={UserPlus}
          title="No applications yet"
          description="Start accepting applications by clicking 'New Application'."
          action={{ label: '+ New Application', href: '/admissions/new' }}
        />
      </div>
    </div>
  );
}
