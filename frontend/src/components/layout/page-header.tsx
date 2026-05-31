import { cn } from '@/lib/utils/cn';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Standard page header component.
 *
 * Layout:
 * ┌────────────────────────────────────────────────────┐
 * │ [Title — 24px bold]    [Secondary CTA] [Primary CTA]│
 * │ [Description — 14px muted]                          │
 * ├────────────────────────────────────────────────────┤
 * │ [Filter / Search / Tab Bar] (passed as children)    │
 * └────────────────────────────────────────────────────┘
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('mb-6 space-y-4', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-erp">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  );
}
