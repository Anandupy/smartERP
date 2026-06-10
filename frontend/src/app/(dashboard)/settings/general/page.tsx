import type { Metadata } from 'next';
import { Settings2 } from 'lucide-react';
import { PageHeader } from '@/ui/v1/components/layout/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const metadata: Metadata = { title: 'System Settings' };

export default function SystemSettingsPage() {
  return (
    <div className="flex flex-col">
      <PageHeader
        title="System Settings"
        description="Configure EduOS platform settings"
        breadcrumbs={[{ label: 'Settings' }, { label: 'System Settings' }]}
        actions={
          <Button size="sm" asChild>
            <Link href="/settings/general/save">
              Save Changes
            </Link>
          </Button>
        }
      >
        <div className="flex gap-1">
          {['General', 'Organization', 'Maintenance', 'Support'].map((tab, i) => (
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
          icon={Settings2}
          title="System settings"
          description="System settings will be available once the system is initialized."
          action={{ label: 'Initialize System', href: '/setup' }}
        />
      </div>
    </div>
  );
}
