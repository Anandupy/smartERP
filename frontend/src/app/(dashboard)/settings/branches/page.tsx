import type { Metadata } from 'next';
import { GitBranch, Plus } from 'lucide-react';
import { PageHeader } from '@/ui/v1/components/layout/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Branch Settings' };

export default function BranchSettingsPage() {
  return (
    <div className="flex flex-col">
      <PageHeader
        title="Branch Settings"
        description="Configure and manage branches (campuses)"
        breadcrumbs={[{ label: 'Settings' }, { label: 'Branches' }]}
        actions={
          <Button size="sm" asChild>
            <Link href="/settings/branches/new">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New Branch
            </Link>
          </Button>
        }
      />
      <div className="p-6">
        <EmptyState
          icon={GitBranch}
          title="No branches configured"
          description="Create a branch to start managing campus operations."
          action={{ label: '+ New Branch', href: '/settings/branches/new' }}
        />
      </div>
    </div>
  );
}
