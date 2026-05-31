'use client';

import { useContextStore } from '@/stores/context.store';
import { useAuthStore } from '@/stores/auth.store';
import { useIsHydrated } from '@/hooks/use-is-hydrated';
import { ChevronRight, Building2, Building, Calendar, BookOpen, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

// ── Context Segment ───────────────────────────────────────────

interface ContextSegmentProps {
  icon: React.ElementType;
  label: string;
  value: string | null;
  placeholder: string;
  isLast?: boolean;
  /** Future: make clickable to open a context picker */
  onClick?: () => void;
}

function ContextSegment({
  icon: Icon,
  label,
  value,
  placeholder,
  isLast = false,
  onClick,
}: ContextSegmentProps) {
  const isEmpty = !value;

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onClick}
        disabled={!onClick}
        aria-label={`${label}: ${value ?? placeholder}`}
        title={`${label}: ${value ?? placeholder}`}
        className={cn(
          'flex items-center gap-1.5 rounded px-2 py-1 text-xs',
          'transition-colors duration-fast',
          isEmpty
            ? 'text-muted-erp cursor-default'
            : onClick
            ? 'text-foreground hover:bg-surface-2 cursor-pointer'
            : 'text-foreground cursor-default',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        )}
      >
        <Icon
          className={cn(
            'h-3 w-3 shrink-0',
            isEmpty ? 'text-muted-erp' : 'text-secondary',
          )}
          aria-hidden
        />
        <span className={cn('max-w-[120px] truncate', isEmpty && 'italic')}>
          {value ?? placeholder}
        </span>
      </button>

      {!isLast && (
        <ChevronRight className="h-3 w-3 shrink-0 text-border-strong" aria-hidden />
      )}
    </div>
  );
}

// ── ContextBar ────────────────────────────────────────────────

/**
 * ERP Context Bar — always visible in the dashboard layout.
 *
 * Shows the current workspace context:
 * Organization → Branch → Academic Year → Program → Financial Year
 *
 * This is a core architectural component. Every ERP module is scoped
 * to this context. Future: each segment opens a picker dropdown.
 *
 * SSR-safe: renders skeleton during hydration.
 */
export function ContextBar() {
  const isHydrated = useIsHydrated();
  const role = useAuthStore((s) => s.role);

  const {
    organizationName,
    branchName,
    academicYearName,
    programName,
    financialYearName,
  } = useContextStore();

  // During SSR and hydration, show a stable placeholder
  if (!isHydrated) {
    return (
      <div
        className="flex h-[var(--contextbar-height)] items-center border-b border-erp bg-surface-2 px-4"
        aria-hidden
      >
        <div className="h-3 w-48 animate-skeleton rounded bg-border" />
      </div>
    );
  }

  const showOrg = role === 'SUPER_ADMIN' || role === 'ORG_ADMIN';
  const showBranch = showOrg || role === 'BRANCH_ADMIN' || role === 'STAFF';

  return (
    <div
      role="navigation"
      aria-label="Workspace context"
      className="flex h-[var(--contextbar-height)] shrink-0 items-center gap-0 border-b border-erp bg-surface-2 px-4 overflow-x-auto"
    >
      {/* Organization — shown to SUPER_ADMIN and ORG_ADMIN */}
      {showOrg && (
        <ContextSegment
          icon={Building2}
          label="Organization"
          value={organizationName}
          placeholder="No organization"
        />
      )}

      {/* Branch */}
      {showBranch && (
        <ContextSegment
          icon={Building}
          label="Branch"
          value={branchName}
          placeholder="No branch"
        />
      )}

      {/* Academic Year */}
      <ContextSegment
        icon={Calendar}
        label="Academic Year"
        value={academicYearName}
        placeholder="No year selected"
      />

      {/* Program */}
      <ContextSegment
        icon={BookOpen}
        label="Program"
        value={programName}
        placeholder="All programs"
      />

      {/* Financial Year — future */}
      <ContextSegment
        icon={Wallet}
        label="Financial Year"
        value={financialYearName}
        placeholder="Financial year"
        isLast
      />

      {/* Spacer and info text */}
      <div className="ml-auto flex items-center gap-1">
        {!branchName && !organizationName && (
          <span className="rounded-md bg-warning-bg px-2 py-0.5 text-[10px] font-medium text-warning">
            Context not set
          </span>
        )}
      </div>
    </div>
  );
}
