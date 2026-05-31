'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Command } from 'lucide-react';
import { useUIStore } from '@/stores/ui.store';
import { NAV_ITEMS } from '@/config/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils/cn';
import type { UserRole } from '@/types/domain.types';

/**
 * Global Command Menu — CMD+K / Ctrl+K search palette.
 *
 * Foundation implementation with navigation links.
 * Phase 2 will add: record search, actions, recent items.
 *
 * Note: This uses a lightweight custom implementation.
 * shadcn/ui Command component can be swapped in after `pnpm dlx shadcn add command`.
 */
export function CommandMenu() {
  const router = useRouter();
  const { commandMenuOpen, setCommandMenuOpen } = useUIStore();
  const role = useAuthStore((s) => s.role);

  // Global keyboard shortcut
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandMenuOpen(true);
      }
      if (e.key === 'Escape') {
        setCommandMenuOpen(false);
      }
    },
    [setCommandMenuOpen],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Filter nav items by role
  const filteredItems = NAV_ITEMS.filter(
    (item) => !role || item.roles.includes(role as UserRole),
  ).filter((item) => !item.isDisabled && !item.isComingSoon);

  if (!commandMenuOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        aria-hidden
        onClick={() => setCommandMenuOpen(false)}
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal
        aria-label="Command menu"
        className={cn(
          'fixed left-1/2 top-[20%] z-50 w-full max-w-lg -translate-x-1/2',
          'rounded-xl border border-erp bg-background shadow-xl',
          'animate-scale-in',
        )}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 border-b border-erp px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-erp" aria-hidden />
          <input
            type="text"
            placeholder="Search pages, actions..."
            autoFocus
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-erp focus:outline-none"
            aria-label="Search"
          />
          <kbd className="rounded border border-erp bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono text-muted-erp">
            ESC
          </kbd>
        </div>

        {/* Quick Links */}
        <div className="p-2">
          <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-erp">
            Navigation
          </p>
          <ul className="space-y-0.5" role="list">
            {filteredItems.slice(0, 8).map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <button
                    onClick={() => {
                      setCommandMenuOpen(false);
                      router.push(item.href);
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm',
                      'text-foreground hover:bg-surface-2',
                      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                      'transition-colors text-left',
                    )}
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded bg-surface-2">
                      <Icon className="h-3.5 w-3.5 text-muted-erp" aria-hidden />
                    </div>
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 border-t border-erp px-4 py-2">
          <div className="flex items-center gap-1 text-[11px] text-muted-erp">
            <Command className="h-3 w-3" aria-hidden />
            <kbd>K</kbd>
            <span className="ml-1">to open</span>
          </div>
          <div className="text-[11px] text-muted-erp">
            Full search coming in Phase 2
          </div>
        </div>
      </div>
    </>
  );
}
