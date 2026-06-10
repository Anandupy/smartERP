import type { Metadata } from 'next';
import { Users, UserPlus } from 'lucide-react';
import { PageHeader } from '@/ui/v1/components/layout/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Users' };

export default function UsersPage() {
  return (
    <div className="flex flex-col">
      <PageHeader
        title="User Management"
        description="Manage user accounts, roles, and access"
        breadcrumbs={[{ label: 'Administration' }, { label: 'Users' }]}
        actions={
          <Button size="sm" asChild>
            <Link href="/administration/users/new">
              <UserPlus className="mr-1.5 h-3.5 w-3.5" />
              New User
            </Link>
          </Button>
        }
      />
      <div className="p-6">
        <EmptyState
          icon={Users}
          title="No users found"
          description="Invite your first team member to get started."
          action={{ label: '+ New User', href: '/administration/users/new' }}
        />
      </div>
    </div>
  );
}
