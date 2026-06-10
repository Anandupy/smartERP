'use client';

import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────

export interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** 'standard' = 420px, 'wide' = 560px */
  width?: 'standard' | 'wide';
  /** Header action buttons */
  actions?: React.ReactNode;
  children: React.ReactNode;
}

// ── Detail Drawer ─────────────────────────────────────────────

/**
 * DetailDrawer — slide-in panel from the right edge.
 *
 * Used for record detail views (Branch, Applicant, Audit Event, etc.)
 * Width: standard 420px, wide 560px (for complex content).
 * Backdrop overlay closes on click.
 * ESC key closes (focus trap handled by browser default for now).
 */
export function DetailDrawer({
  open,
  onClose,
  title,
  subtitle,
  width = 'standard',
  actions,
  children,
}: DetailDrawerProps) {
  // ESC key handler
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Prevent body scroll when open
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
          aria-hidden
          onClick={onClose}
        />
      )}

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex flex-col',
          'bg-background shadow-[var(--shadow-drawer)]',
          'transition-transform duration-300',
          width === 'wide' ? 'w-[560px]' : 'w-[420px]',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold leading-tight text-foreground">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-[12px] text-text-muted">{subtitle}</p>
            )}
          </div>
          <div className="ml-4 flex shrink-0 items-center gap-1">
            {actions}
            <button
              onClick={onClose}
              aria-label="Close drawer"
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md',
                'text-text-muted transition-colors',
                'hover:bg-surface-2 hover:text-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-4">
          {children}
        </div>
      </div>
    </>
  );
}
