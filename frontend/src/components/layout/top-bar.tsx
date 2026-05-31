'use client';

import { useAuthStore } from '@/stores/auth.store';
import { useUIStore } from '@/stores/ui.store';
import { useLogout } from '@/modules/auth/hooks/use-auth';
import { useIsHydrated } from '@/hooks/use-is-hydrated';
import {
  Search,
  Bell,
  Sun,
  Moon,
  Monitor,
  ChevronDown,
  LogOut,
  User,
  Settings,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { getInitials } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { useState, useRef, useEffect } from 'react';

// ── UserMenu ─────────────────────────────────────────────────

function UserMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const user = useAuthStore((s) => s.user);
  const { mutate: logout, isPending } = useLogout();

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const initials = getInitials(user?.fullName || user?.email || 'U');

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="User menu"
        className={cn(
          'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm',
          'hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'transition-colors',
        )}
      >
        {/* Avatar */}
        <div
          className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-secondary-foreground text-xs font-semibold"
          aria-hidden
        >
          {initials}
        </div>
        {/* Name (hidden on small screens) */}
        <span className="hidden max-w-[120px] truncate text-sm font-medium text-foreground sm:block">
          {user?.fullName || user?.email || 'User'}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-erp" aria-hidden />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="menu"
          aria-label="User menu"
          className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-erp bg-background py-1 shadow-md"
        >
          {/* User info */}
          <div className="border-b border-erp px-3 py-2">
            <p className="truncate text-sm font-medium text-foreground">
              {user?.fullName || 'User'}
            </p>
            <p className="truncate text-xs text-muted-erp">{user?.email}</p>
          </div>

          {/* Menu items */}
          <a
            href="/profile"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-2"
            onClick={() => setOpen(false)}
          >
            <User className="h-4 w-4 text-muted-erp" aria-hidden />
            My Profile
          </a>
          <a
            href="/settings"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-2"
            onClick={() => setOpen(false)}
          >
            <Settings className="h-4 w-4 text-muted-erp" aria-hidden />
            Settings
          </a>

          <div className="border-t border-erp mt-1 pt-1">
            <button
              role="menuitem"
              disabled={isPending}
              onClick={() => {
                setOpen(false);
                logout({});
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive-bg disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              {isPending ? 'Signing out...' : 'Sign out'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ThemeToggle ───────────────────────────────────────────────

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isHydrated = useIsHydrated();

  if (!isHydrated) return <div className="h-8 w-8" />;

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  return (
    <button
      onClick={cycleTheme}
      aria-label={`Current theme: ${theme}. Click to cycle.`}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-md text-muted-erp',
        'hover:bg-surface-2 hover:text-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'transition-colors',
      )}
    >
      {theme === 'dark' ? (
        <Moon className="h-4 w-4" aria-hidden />
      ) : theme === 'system' ? (
        <Monitor className="h-4 w-4" aria-hidden />
      ) : (
        <Sun className="h-4 w-4" aria-hidden />
      )}
    </button>
  );
}

// ── TopBar ────────────────────────────────────────────────────

/**
 * Top navigation bar.
 * Fixed at the top, full width (including sidebar overlap handled by parent).
 *
 * Contains:
 * - Page title / breadcrumb area (left)
 * - CMD+K search trigger (center-left)
 * - Theme toggle, notifications, user menu (right)
 */
export function TopBar() {
  const { setCommandMenuOpen } = useUIStore();

  return (
    <header
      role="banner"
      className={cn(
        'z-20 flex h-[var(--topbar-height)] shrink-0 items-center gap-4',
        'border-b border-erp bg-background px-4',
        'sticky top-0',
      )}
    >
      {/* Left — skip to content link (accessibility) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-primary focus:px-3 focus:py-1 focus:text-sm focus:text-primary-foreground"
      >
        Skip to main content
      </a>

      {/* Search trigger */}
      <button
        onClick={() => setCommandMenuOpen(true)}
        aria-label="Open command menu (Ctrl+K)"
        className={cn(
          'flex items-center gap-2 rounded-md border border-erp bg-surface px-3 py-1.5',
          'text-sm text-muted-erp',
          'hover:bg-surface-2 hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'transition-colors',
          'w-48 sm:w-64',
        )}
      >
        <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="flex-1 text-left">Search...</span>
        <kbd className="hidden rounded border border-erp bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono text-muted-erp sm:inline">
          ⌘K
        </kbd>
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right actions */}
      <div className="flex items-center gap-1">
        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <button
          aria-label="Notifications"
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-md text-muted-erp',
            'hover:bg-surface-2 hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'transition-colors relative',
          )}
        >
          <Bell className="h-4 w-4" aria-hidden />
          {/* Notification badge — placeholder */}
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-error" aria-hidden />
        </button>

        {/* Divider */}
        <div className="mx-1 h-5 w-px bg-border-erp" aria-hidden />

        {/* User Menu */}
        <UserMenu />
      </div>
    </header>
  );
}
