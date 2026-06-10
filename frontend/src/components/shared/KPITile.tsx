import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface KPITileProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: {
    value: number;   // percentage, e.g. 2.4
    label?: string;  // e.g. "vs last month"
    direction?: 'up' | 'down' | 'neutral';
  };
  /** Accent color variant — defaults to no accent */
  color?: 'primary' | 'success' | 'warning' | 'info' | 'default';
  className?: string;
}

/**
 * KPITile — dashboard metric card.
 *
 * Matches DESIGN_SYSTEM.md §3.2:
 *   Surface background, border, shadow-xs
 *   Label: sm muted | Value: 3xl bold | Trend: xs colored
 */
export function KPITile({
  label,
  value,
  icon: Icon,
  trend,
  color = 'default',
  className,
}: KPITileProps) {
  const trendDirection = trend?.direction
    ?? (trend && trend.value > 0
      ? 'up'
      : trend && trend.value < 0
      ? 'down'
      : 'neutral');

  const TrendIcon =
    trendDirection === 'up'
      ? TrendingUp
      : trendDirection === 'down'
      ? TrendingDown
      : Minus;

  const trendColorClass =
    trendDirection === 'up'
      ? 'text-success'
      : trendDirection === 'down'
      ? 'text-destructive'
      : 'text-text-muted';

  const accentClass: Record<string, string> = {
    primary: 'border-l-4 border-l-primary',
    success:  'border-l-4 border-l-success',
    warning:  'border-l-4 border-l-warning',
    info:     'border-l-4 border-l-info',
    default:  '',
  };

  return (
    <div
      className={cn(
        'erp-card flex flex-col gap-3 p-4',
        accentClass[color],
        className,
      )}
    >
      {/* Label + Icon row */}
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-text-muted">{label}</span>
        {Icon && (
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-2">
            <Icon className="h-3.5 w-3.5 text-text-muted" aria-hidden />
          </div>
        )}
      </div>

      {/* Value */}
      <div className="text-3xl font-bold leading-none tracking-tight text-foreground">
        {value}
      </div>

      {/* Trend */}
      {trend && (
        <div className={cn('flex items-center gap-1 text-[11px]', trendColorClass)}>
          <TrendIcon className="h-3 w-3 shrink-0" aria-hidden />
          <span>
            {trend.value > 0 ? '+' : ''}{trend.value}%
            {trend.label && (
              <span className="ml-1 text-text-muted">{trend.label}</span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
