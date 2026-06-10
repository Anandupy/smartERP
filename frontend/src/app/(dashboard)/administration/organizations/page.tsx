import type { Metadata } from 'next';
import { Building2, Plus, Upload } from 'lucide-react';
import { PageHeader } from '@/ui/v1/components/layout/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Organizations' };

export default function OrganizationsPage() {
  return (
    <div className="flex flex-col">
      <PageHeader
        title="Organizations"
        description="Manage educational institutions on the platform"
        breadcrumbs={[{ label: 'Administration' }, { label: 'Organizations' }]}
        actions={
          <>
            <Button size="sm" variant="outline" asChild>
              <Link href="/administration/organizations/import">
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                Import
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/administration/organizations/new">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                New Organization
              </Link>
            </Button>
          </>
        }
      >
        <div className="flex items-center gap-1">
          {['All', 'Active', 'Trial', 'Expired'].map((tab, i) => (
            <button
              key={tab}
              className={`rounded-md px-3 py-1 text-[12px] font-medium transition-colors ${
                i === 0
                  ? 'bg-primary text-primary-foreground'
                  : 'text-text-secondary hover:bg-surface-2 hover:text-foreground'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </PageHeader>
      <div className="p-6">
        <EmptyState
          icon={Building2}
          title="No organizations yet"
          description="Add your first organization to start managing educational institutions on EduOS."
          action={{ label: '+ New Organization', href: '/administration/organizations/new' }}
        />
      </div>
    </div>
  );
}
