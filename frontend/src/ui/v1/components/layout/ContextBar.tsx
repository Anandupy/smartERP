'use client';

import React from 'react';
import {
  Building2,
  GitBranch,
  CalendarDays,
  BookOpen,
  Wallet,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { useContextStore } from '@/stores/context.store';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────

interface ContextSegment {
  key: string;
  icon: React.ElementType;
  label: string | null;
  placeholder: string | null; // null = optional segment (hidden when empty)
  isRequired: boolean;
}

// ── Segment Component ─────────────────────────────────────────

function ContextSegmentButton({
  segment,
}: {
  segment: ContextSegment;
}) {
  const isSet = Boolean(segment.label);
  const isMissing = segment.isRequired && !isSet;

  // Optional segments are hidden entirely when not set
  if (!segment.isRequired && !isSet) return null;

  return (
    <button
      className={cn(
        'flex items-center gap-1.5 rounded px-1.5 py-0.5',
        'text-[11px] font-medium leading-none',
        'transition-colors hover:bg-border',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        isMissing
          ? 'text-warning hover:bg-warning-bg'
          : isSet
          ? 'text-text-secondary hover:bg-border'
          : 'text-text-muted',
      )}
      aria-label={`Change ${segment.key.replace('-', ' ')}`}
      title={
        isMissing
          ? `${segment.placeholder} — click to configure`
          : segment.label ?? undefined
      }
    >
      {isMissing ? (
        <AlertCircle className="h-3 w-3 shrink-0 text-warning" aria-hidden />
      ) : (
        <segment.icon
          className={cn(
            'h-3 w-3 shrink-0',
            isSet ? 'text-text-muted' : 'text-text-disabled',
          )}
          aria-hidden
        />
      )}
      <span
        className={cn(
          isMissing && 'text-warning',
          isSet && 'text-text-secondary',
          !isSet && !isMissing && 'text-text-muted',
        )}
      >
        {segment.label ?? segment.placeholder}
      </span>
    </button>
  );
}

// ── Separator ─────────────────────────────────────────────────

function ContextSeparator() {
  return (
    <ChevronRight
      className="h-3 w-3 shrink-0 text-text-disabled"
      aria-hidden
    />
  );
}

// ── Context Bar ───────────────────────────────────────────────

/**
 * ContextBar — ERP workspace context indicator.
 *
 * Shows the current operational context:
 *   Organization → Branch → Academic Year → Program (optional)
 *   and separately: Financial Year (optional, right-aligned)
 *
 * Note: Academic Year and Financial Year are intentionally separate.
 *   Academic Year: 2025-2026 (academic calendar)
 *   Financial Year: Apr 2025 – Mar 2026 (fiscal calendar)
 * These may or may not align, and must not be conflated.
 *
 * Each segment is clickable for future selector dropdown (TBD).
 */
export function ContextBar() {
  const {
    organizationName,
    branchName,
    academicYearName,
    programName,
    financialYearName,
  } = useContextStore();

  // Primary context chain (left side)
  const primarySegments: ContextSegment[] = [
    {
      key: 'organization',
      icon: Building2,
      label: organizationName,
      placeholder: 'No Organization',
      isRequired: true,
    },
    {
      key: 'branch',
      icon: GitBranch,
      label: branchName,
      placeholder: 'No Branch',
      isRequired: true,
    },
    {
      key: 'academic-year',
      icon: CalendarDays,
      label: academicYearName,
      placeholder: 'No Academic Year',
      isRequired: true,
    },
    {
      key: 'program',
      icon: BookOpen,
      label: programName,
      placeholder: 'All Programs',
      isRequired: false, // Optional filter
    },
  ];

  // Financial year is displayed separately (right side) — NOT the same as academic year
  const financialSegment: ContextSegment = {
    key: 'financial-year',
    icon: Wallet,
    label: financialYearName,
    placeholder: 'No Financial Year',
    isRequired: false,
  };

  return (
    <div
      className={cn(
        'flex h-[var(--contextbar-height)] shrink-0 items-center justify-between',
        'border-b border-border bg-surface-2 px-4',
        'overflow-hidden',
      )}
      role="navigation"
      aria-label="Workspace context"
    >
      {/* ── Primary context chain ── */}
      <div className="flex min-w-0 items-center gap-1">
        {primarySegments.map((seg, index) => {
          // Skip hidden optional segments
          if (!seg.isRequired && !seg.label) return null;

          return (
            <React.Fragment key={seg.key}>
              {index > 0 && <ContextSeparator />}
              <ContextSegmentButton segment={seg} />
            </React.Fragment>
          );
        })}
      </div>

      {/* ── Financial Year (separate from academic year) ── */}
      {financialSegment.label && (
        <div className="flex items-center gap-1 text-text-muted">
          <span className="mr-0.5 text-[10px] text-text-disabled">FY</span>
          <ContextSegmentButton segment={financialSegment} />
        </div>
      )}
    </div>
  );
}
