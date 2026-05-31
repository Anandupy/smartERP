import { cn } from '@/lib/utils/cn';
import type { StatusVariant } from '@/types/ui.types';

interface StatusBadgeProps {
  status: StatusVariant | string;
  label?: string;
  className?: string;
}

const STATUS_STYLES: Record<StatusVariant, string> = {
  active: 'bg-success-bg text-success border-success/20',
  inactive: 'bg-surface-2 text-muted-erp border-border',
  pending: 'bg-warning-bg text-warning border-warning/20',
  suspended: 'bg-destructive-bg text-destructive border-destructive/20',
  locked: 'bg-secondary/10 text-secondary border-secondary/20',
  current: 'bg-primary text-primary-foreground border-transparent',
  archive: 'bg-surface-2 text-muted-erp border-border',
  draft: 'bg-surface-2 text-secondary border-border',
  submitted: 'bg-info-bg text-info border-info/20',
  approved: 'bg-success-bg text-success border-success/20',
  rejected: 'bg-destructive-bg text-destructive border-destructive/20',
  cancelled: 'bg-surface-2 text-muted-erp border-border',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  inactive: 'Inactive',
  pending: 'Pending',
  suspended: 'Suspended',
  locked: 'Locked',
  current: 'Current',
  archive: 'Archive',
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

/**
 * Status badge component — consistent pill for entity statuses.
 *
 * @example
 * <StatusBadge status="active" />
 * <StatusBadge status="UNDER_REVIEW" label="Under Review" />
 */
export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const normalized = status.toLowerCase().replace(/_/g, '-') as StatusVariant;
  const styles = STATUS_STYLES[normalized] ?? 'bg-surface-2 text-muted-erp border-border';
  const displayLabel = label ?? STATUS_LABELS[normalized] ?? status;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
        styles,
        className,
      )}
    >
      {displayLabel}
    </span>
  );
}
