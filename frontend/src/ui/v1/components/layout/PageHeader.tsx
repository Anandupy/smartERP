import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  /** Page title — 24px bold */
  title: string;
  /** Optional subtitle — 14px muted */
  description?: string;
  /** Right-side action buttons */
  actions?: React.ReactNode;
  /** Breadcrumb trail above title */
  breadcrumbs?: BreadcrumbItem[];
  /** Extra content below title (tabs, filters, etc.) */
  children?: React.ReactNode;
  className?: string;
}

// ── Breadcrumbs ───────────────────────────────────────────────

function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={index}>
            {index > 0 && (
              <ChevronRight
                className="h-3 w-3 shrink-0 text-text-disabled"
                aria-hidden
              />
            )}
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className={cn(
                  'text-[11px] text-text-muted transition-colors',
                  'hover:text-text-secondary',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                )}
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={cn(
                  'text-[11px]',
                  isLast ? 'text-text-secondary font-medium' : 'text-text-muted',
                )}
                aria-current={isLast ? 'page' : undefined}
              >
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

// ── Page Header ───────────────────────────────────────────────

/**
 * PageHeader — consistent page title block for all EduOS modules.
 *
 * Structure:
 *   [Breadcrumbs]
 *   [Title 24px bold]    [Secondary CTA] [Primary CTA]
 *   [Description 14px muted]
 *   ─────────────────────────────────────────────────
 *   [Optional children — tabs, filter bar, etc.]
 */
export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'border-b border-border bg-background',
        className,
      )}
    >
      <div className="px-6 py-4">
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <div className="mb-1.5">
            <Breadcrumbs items={breadcrumbs} />
          </div>
        )}

        {/* Title row */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground">
              {title}
            </h1>
            {description && (
              <p className="mt-0.5 text-[13px] text-text-muted">{description}</p>
            )}
          </div>

          {/* Actions */}
          {actions && (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          )}
        </div>
      </div>

      {/* Sub-content (tabs, filter bar) */}
      {children && (
        <div className="border-t border-border px-6 py-2">{children}</div>
      )}
    </div>
  );
}
