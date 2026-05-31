import type { LucideIcon } from 'lucide-react';
import { PackageOpen } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Standard empty state component.
 * Used in tables, lists, and content areas when no data is present.
 */
export function EmptyState({
  title,
  description,
  icon: Icon = PackageOpen,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-12 text-center',
        className,
      )}
      role="status"
      aria-label={title}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-2 text-muted-erp">
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <div className="max-w-xs space-y-1">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="text-sm text-muted-erp">{description}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
