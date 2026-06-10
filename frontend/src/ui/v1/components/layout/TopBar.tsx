'use client';

import { Bell, Search, LogOut, Settings, User, ChevronDown } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils';

/**
 * TopBar — 56px height header.
 *
 * Left:   Page context (future breadcrumb)
 * Center: Global search trigger (CMD+K)
 * Right:  Notifications | User menu
 */
export function TopBar() {
  const user = useAuthStore((s) => s.user);

  const initials = user?.fullName
    ? user.fullName
        .split(' ')
        .slice(0, 2)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : 'U';

  const roleLabel: Record<string, string> = {
    SUPER_ADMIN: 'Super Admin',
    ORG_ADMIN: 'Org Admin',
    BRANCH_ADMIN: 'Branch Admin',
    STAFF: 'Staff',
    STUDENT: 'Student',
    PARENT: 'Parent',
  };

  return (
    <header
      className={cn(
        'flex h-[var(--topbar-height)] shrink-0 items-center justify-between',
        'border-b border-border bg-background px-4',
        'z-20',
      )}
    >
      {/* ── Left ── */}
      <div className="flex items-center gap-3">
        {/* Reserved for page-level title / breadcrumb (injected by pages) */}
        <div id="topbar-title" />
      </div>

      {/* ── Center — Global Search ── */}
      <button
        className={cn(
          'flex items-center gap-2 rounded-md border border-border',
          'bg-surface px-3 py-1.5 text-[13px] text-text-muted',
          'transition-colors hover:border-border-strong hover:bg-surface-2',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'min-w-[200px] max-w-[280px]',
        )}
        aria-label="Search (⌘K)"
      >
        <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-text-disabled">
          ⌘K
        </kbd>
      </button>

      {/* ── Right ── */}
      <div className="flex items-center gap-1">
        {/* Notifications */}
        <button
          aria-label="Notifications"
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-md',
            'text-text-muted transition-colors',
            'hover:bg-surface-2 hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          <Bell className="h-4 w-4" aria-hidden />
        </button>

        {/* Divider */}
        <div className="mx-1 h-5 w-px bg-border" aria-hidden />

        {/* User Menu */}
        <button
          className={cn(
            'flex items-center gap-2 rounded-md px-2 py-1',
            'transition-colors hover:bg-surface-2',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
          aria-label="User menu"
        >
          {/* Avatar */}
          <div
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-full',
              'bg-primary text-[10px] font-bold text-primary-foreground',
            )}
          >
            {initials}
          </div>

          {/* Name + Role */}
          <div className="hidden flex-col text-left sm:flex">
            <span className="text-[12px] font-medium leading-tight text-foreground">
              {user?.fullName ?? 'User'}
            </span>
            <span className="text-[10px] leading-tight text-text-muted">
              {roleLabel[user?.role ?? ''] ?? user?.role ?? ''}
            </span>
          </div>

          <ChevronDown className="h-3 w-3 text-text-muted" aria-hidden />
        </button>
      </div>
    </header>
  );
}
