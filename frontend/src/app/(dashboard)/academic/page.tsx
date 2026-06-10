import type { Metadata } from 'next';
import { Network, Plus, Search } from 'lucide-react';
import { PageHeader } from '@/ui/v1/components/layout/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Academic Units' };

export default function AcademicUnitsPage() {
  return (
    <div className="flex flex-col">
      <PageHeader
        title="Academic Unit Explorer"
        description="Manage the academic hierarchy — classes, divisions, departments"
        breadcrumbs={[{ label: 'Academics' }, { label: 'Academic Units' }]}
        actions={
          <Button size="sm" asChild>
            <Link href="/academic/new">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Unit
            </Link>
          </Button>
        }
      >
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            placeholder="Search units…"
            className="h-7 w-56 rounded-md border border-border bg-background pl-8 pr-3 text-[13px] placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </PageHeader>
      <div className="p-6">
        <EmptyState
          icon={Network}
          title="No academic units yet"
          description="Add units to build your academic hierarchy. Supports School (Class → Division), College (Department → Year → Batch), and custom structures."
          action={{ label: '+ Add Unit', href: '/academic/new' }}
        />
      </div>
    </div>
  );
}
