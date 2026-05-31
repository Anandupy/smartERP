import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { formatNumber } from '@/lib/utils/format';

interface KPITileProps {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    label?: string;
    direction: 'up' | 'down' | 'neutral';
  };
  isLoading?: boolean;
  className?: string;
}

/**
 * KPI Tile — dashboard metric card.
 *
 * Layout:
 * ┌─────────────────────────────┐
 * │ Label              [Icon]   │
 * │                             │
 * │ 4,289                       │
 * │ ↑ +2.4% vs last month       │
 * └─────────────────────────────┘
 */
export function KPITile({
  label,
  value,
  icon: Icon,
  trend,
  isLoading = false,
  className,
}: KPITileProps) {
  if (isLoading) {
    return (
      <div
        className={cn(
          'rounded-lg border border-erp bg-surface p-4 shadow-xs',
          className,
        )}
        aria-hidden
      >
        <div className="space-y-3">
          <div className="h-3 w-20 animate-skeleton rounded bg-surface-2" />
          <div className="h-8 w-28 animate-skeleton rounded bg-surface-2" />
          <div className="h-3 w-32 animate-skeleton rounded bg-surface-2" />
        </div>
      </div>
    );
  }

  const displayValue =
    typeof value === 'number' ? formatNumber(value) : value;

  const TrendIcon =
    trend?.direction === 'up'
      ? TrendingUp
      : trend?.direction === 'down'
      ? TrendingDown
      : Minus;

  const trendColor =
    trend?.direction === 'up'
      ? 'text-success'
      : trend?.direction === 'down'
      ? 'text-destructive'
      : 'text-muted-erp';

  return (
    <div
      className={cn(
        'rounded-lg border border-erp bg-surface p-4 shadow-xs',
        'hover:shadow-sm transition-shadow',
        className,
      )}
      role="figure"
      aria-label={`${label}: ${displayValue}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-muted-erp">{label}</p>
        {Icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-muted-erp">
            <Icon className="h-4 w-4" aria-hidden />
          </div>
        )}
      </div>

      <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">
        {displayValue}
      </p>

      {trend && (
        <div className={cn('mt-1.5 flex items-center gap-1 text-xs', trendColor)}>
          <TrendIcon className="h-3.5 w-3.5" aria-hidden />
          <span>
            {trend.value > 0 ? '+' : ''}{trend.value}
            {trend.label ? ` ${trend.label}` : ''}
          </span>
        </div>
      )}
    </div>
  );
}
