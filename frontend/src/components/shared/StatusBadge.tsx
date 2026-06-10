import { cn } from '@/lib/utils';
import type { StatusVariant } from '@/types/ui.types';

// ── Status configuration ──────────────────────────────────────

const STATUS_CONFIG: Record<
  StatusVariant,
  { label: string; className: string }
> = {
  active: {
    label: 'Active',
    className:
      'bg-success-bg text-success border-success/20',
  },
  inactive: {
    label: 'Inactive',
    className:
      'bg-surface-2 text-text-muted border-border',
  },
  pending: {
    label: 'Pending',
    className:
      'bg-warning-bg text-warning border-warning/20',
  },
  suspended: {
    label: 'Suspended',
    className:
      'bg-destructive/10 text-destructive border-destructive/20',
  },
  locked: {
    label: 'Locked',
    className:
      'bg-accent/10 text-accent border-accent/20',
  },
  current: {
    label: 'Current',
    className:
      'bg-primary text-primary-foreground border-transparent',
  },
  archive: {
    label: 'Archive',
    className:
      'bg-surface-2 text-text-muted border-border',
  },
  draft: {
    label: 'Draft',
    className:
      'bg-surface-2 text-text-secondary border-border',
  },
  submitted: {
    label: 'Submitted',
    className:
      'bg-info-bg text-info border-info/20',
  },
  approved: {
    label: 'Approved',
    className:
      'bg-success-bg text-success border-success/20',
  },
  rejected: {
    label: 'Rejected',
    className:
      'bg-destructive/10 text-destructive border-destructive/20',
  },
  cancelled: {
    label: 'Cancelled',
    className:
      'bg-surface-2 text-text-muted border-border line-through',
  },
};

// ── Props ─────────────────────────────────────────────────────

export interface StatusBadgeProps {
  status: StatusVariant;
  label?: string; // override default label
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

// ── Component ─────────────────────────────────────────────────

/**
 * StatusBadge — lifecycle state pill.
 *
 * Matches DESIGN_SYSTEM.md §3.1 Status Badge System.
 * Colors are fully token-driven — Theme Studio affects them.
 */
export function StatusBadge({
  status,
  label,
  size = 'sm',
  className,
}: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.inactive;
  const displayLabel = label ?? config.label;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium',
        size === 'xs' && 'px-1.5 py-0.5 text-[10px]',
        size === 'sm' && 'px-2 py-0.5 text-[11px]',
        size === 'md' && 'px-2.5 py-1 text-xs',
        config.className,
        className,
      )}
    >
      {displayLabel}
    </span>
  );
}
