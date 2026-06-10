import { cn } from '@/lib/utils';

// ── Base Skeleton ──────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-skeleton rounded bg-surface-2', className)}
      aria-hidden
    />
  );
}

// ── Table Skeleton ─────────────────────────────────────────────

const TABLE_COL_WIDTHS = [40, 180, 120, 100, 80, 60];

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-border px-4 py-2.5">
        {TABLE_COL_WIDTHS.map((w, i) => (
          /* Wrap in div to carry the width — Skeleton only accepts className */
          <div key={i} style={{ width: w, flexShrink: 0 }}>
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="flex items-center gap-4 border-b border-border px-4"
          style={{ height: 'var(--table-row-height)' }}
        >
          {TABLE_COL_WIDTHS.map((w, i) => (
            <div key={i} style={{ width: w, flexShrink: 0 }}>
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Card Skeleton ──────────────────────────────────────────────

export function CardSkeleton() {
  return (
    <div className="erp-card p-4">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
        <Skeleton className="h-7 w-7 rounded-md" />
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-3/5" />
      </div>
    </div>
  );
}

// ── KPI Grid Skeleton ──────────────────────────────────────────

export function KPIGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="erp-card space-y-3 p-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-7 rounded-md" />
          </div>
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-2.5 w-32" />
        </div>
      ))}
    </div>
  );
}

// ── Form Skeleton ──────────────────────────────────────────────

export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-5">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-full rounded-lg" />
        </div>
      ))}
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-8 w-20 rounded-md" />
        <Skeleton className="h-8 w-16 rounded-md" />
      </div>
    </div>
  );
}

// ── Page Header Skeleton ───────────────────────────────────────

export function PageHeaderSkeleton() {
  return (
    <div className="border-b border-border bg-background px-6 py-4">
      <Skeleton className="mb-1.5 h-2.5 w-32" />
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3 w-72" />
        </div>
        <Skeleton className="h-8 w-28 rounded-md" />
      </div>
    </div>
  );
}
