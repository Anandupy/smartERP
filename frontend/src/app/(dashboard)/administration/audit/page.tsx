import type { Metadata } from 'next';
import { ClipboardList, Download } from 'lucide-react';
import { PageHeader } from '@/ui/v1/components/layout/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Audit Logs' };

export default function AuditPage() {
  return (
    <div className="flex flex-col">
      <PageHeader
        title="Audit Center"
        description="System-wide event log for compliance and debugging"
        breadcrumbs={[{ label: 'Administration' }, { label: 'Audit Logs' }]}
        actions={
          <Button size="sm" variant="outline">
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export
          </Button>
        }
      />
      <div className="p-6">
        <EmptyState
          icon={ClipboardList}
          title="No audit events yet"
          description="Audit events will appear here as actions are taken in the system."
        />
      </div>
    </div>
  );
}
