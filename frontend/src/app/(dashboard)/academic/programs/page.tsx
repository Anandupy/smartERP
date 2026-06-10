import type { Metadata } from 'next';
import { BookOpen, Plus, GitBranch } from 'lucide-react';
import { PageHeader } from '@/ui/v1/components/layout/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Programs' };

export default function ProgramsPage() {
  return (
    <div className="flex flex-col">
      <PageHeader
        title="Programs"
        description="Define academic programs and their hierarchy"
        breadcrumbs={[{ label: 'Academics' }, { label: 'Programs' }]}
        actions={
          <>
            <Button size="sm" variant="outline" asChild>
              <Link href="/academic/programs/tree">
                <GitBranch className="mr-1.5 h-3.5 w-3.5" />
                Tree View
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/academic/programs/new">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                New Program
              </Link>
            </Button>
          </>
        }
      />
      <div className="p-6">
        <EmptyState
          icon={BookOpen}
          title="No programs defined"
          description="Define programs to organize your academic structure. Examples: Primary English, B.Tech Computer Science."
          action={{ label: '+ New Program', href: '/academic/programs/new' }}
        />
      </div>
    </div>
  );
}
