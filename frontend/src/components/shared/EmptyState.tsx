import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /**
   * Primary CTA — uses an href link (works in both Server and Client Components).
   * For onClick handlers, wrap EmptyState in a Client Component.
   */
  action?: {
    label: string;
    href: string;
  };
  secondaryAction?: {
    label: string;
    href: string;
  };
  className?: string;
}

/**
 * EmptyState — zero-data placeholder.
 *
 * Uses Link (href) for actions so it works in Server Components.
 * Matches DESIGN_SYSTEM.md §3.5.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 text-center',
        className,
      )}
    >
      {/* Icon */}
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-2">
        <Icon className="h-6 w-6 text-text-muted" aria-hidden />
      </div>

      {/* Title */}
      <h3 className="text-[18px] font-semibold text-foreground">{title}</h3>

      {/* Description */}
      {description && (
        <p className="mt-1.5 max-w-[320px] text-[13px] leading-relaxed text-text-muted">
          {description}
        </p>
      )}

      {/* Actions — Link-based for Server Component compatibility */}
      {(action || secondaryAction) && (
        <div className="mt-5 flex items-center gap-3">
          {action && (
            <Link
              href={action.href}
              className="inline-flex h-8 items-center rounded-lg border border-transparent bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              {action.label}
            </Link>
          )}
          {secondaryAction && (
            <Link
              href={secondaryAction.href}
              className="inline-flex h-8 items-center rounded-lg px-3 text-[13px] font-medium text-text-secondary transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              {secondaryAction.label}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
