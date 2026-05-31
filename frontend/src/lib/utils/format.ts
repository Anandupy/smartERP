import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns';

// ── Date Formatting ───────────────────────────────────────────

/**
 * Format an ISO date string to a human-readable date.
 * @example formatDate('2024-04-01') → 'Apr 1, 2024'
 */
export function formatDate(
  dateStr: string | Date | null | undefined,
  fmt = 'MMM d, yyyy',
): string {
  if (!dateStr) return '—';
  try {
    const date =
      typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
    if (!isValid(date)) return '—';
    return format(date, fmt);
  } catch {
    return '—';
  }
}

/**
 * Format an ISO date string with time.
 * @example formatDateTime('2024-04-01T10:30:00Z') → 'Apr 1, 2024, 10:30 AM'
 */
export function formatDateTime(
  dateStr: string | Date | null | undefined,
): string {
  return formatDate(dateStr, 'MMM d, yyyy, h:mm a');
}

/**
 * Return a relative time string (e.g., "3 hours ago").
 */
export function formatRelativeTime(
  dateStr: string | Date | null | undefined,
): string {
  if (!dateStr) return '—';
  try {
    const date =
      typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
    if (!isValid(date)) return '—';
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return '—';
  }
}

/**
 * Format a date range.
 * @example formatDateRange('2024-04-01', '2025-03-31') → 'Apr 1, 2024 – Mar 31, 2025'
 */
export function formatDateRange(
  startStr: string | null | undefined,
  endStr: string | null | undefined,
): string {
  const start = formatDate(startStr);
  const end = formatDate(endStr);
  if (start === '—' || end === '—') return '—';
  return `${start} – ${end}`;
}

// ── Number Formatting ─────────────────────────────────────────

/**
 * Format a number with locale-aware thousands separators.
 * @example formatNumber(4289) → '4,289'
 */
export function formatNumber(
  value: number | null | undefined,
  options?: Intl.NumberFormatOptions,
): string {
  if (value === null || value === undefined || isNaN(value)) return '—';
  return new Intl.NumberFormat('en-IN', options).format(value);
}

/**
 * Format a currency amount.
 * @example formatCurrency(12500, 'INR') → '₹12,500'
 */
export function formatCurrency(
  value: number | null | undefined,
  currency = 'INR',
): string {
  if (value === null || value === undefined || isNaN(value)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a percentage.
 * @example formatPercent(0.245) → '24.5%'
 */
export function formatPercent(
  value: number | null | undefined,
  decimals = 1,
): string {
  if (value === null || value === undefined || isNaN(value)) return '—';
  return `${(value * 100).toFixed(decimals)}%`;
}

// ── Name Formatting ───────────────────────────────────────────

/**
 * Get initials from a full name.
 * @example getInitials('John Michael Doe') → 'JD'
 */
export function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return (parts[0]?.[0] ?? '?').toUpperCase();
  return `${parts[0]?.[0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase();
}

/**
 * Truncate a string to a max length with ellipsis.
 */
export function truncate(str: string | null | undefined, maxLength = 50): string {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength - 3)}...`;
}

/**
 * Convert a snake_case or SCREAMING_SNAKE_CASE string to Title Case.
 * @example toTitleCase('BRANCH_ADMIN') → 'Branch Admin'
 */
export function toTitleCase(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
