import type { Metadata } from 'next';
import { CalendarDays, Plus } from 'lucide-react';
import { PageHeader } from '@/ui/v1/components/layout/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Academic Years' };

export default function AcademicYearsPage() {
  return (
    <div className="flex flex-col">
      <PageHeader
        title="Academic Year Workspace"
        description="Manage the academic calendar lifecycle"
        breadcrumbs={[{ label: 'Settings' }, { label: 'Academic Years' }]}
        actions={
          <Button size="sm" asChild>
            <Link href="/settings/academic/new">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New Year
            </Link>
          </Button>
        }
      />
      <div className="p-6 space-y-5">
        {/* Lifecycle timeline */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {['ARCHIVE', 'LOCKED', 'CURRENT', 'PLANNED'].map((state, i) => (
            <div key={state} className="flex items-center gap-2 shrink-0">
              {i > 0 && <div className="h-px w-8 bg-border" />}
              <div
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium ${
                  state === 'CURRENT'
                    ? 'border-transparent bg-primary text-primary-foreground'
                    : 'border-border bg-surface text-text-muted'
                }`}
              >
                <div className={`h-1.5 w-1.5 rounded-full ${state === 'CURRENT' ? 'bg-primary-foreground' : 'bg-border-strong'}`} />
                {state}
              </div>
            </div>
          ))}
        </div>
        <EmptyState
          icon={CalendarDays}
          title="No academic years"
          description="Create your first academic year to start managing academic operations."
          action={{ label: '+ New Academic Year', href: '/settings/academic/new' }}
        />
      </div>
    </div>
  );
}
