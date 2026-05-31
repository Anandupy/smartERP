'use client';

import { useIsHydrated } from '@/hooks/use-is-hydrated';
import { useUIStore } from '@/stores/ui.store';
import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';
import { ContextBar } from './context-bar';
import { cn } from '@/lib/utils/cn';

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * Application Shell — the master layout for all dashboard pages.
 *
 * Layout structure:
 * ┌─────────────────────────────────────────────────────────┐
 * │  TOPBAR (56px fixed)                                    │
 * ├──────────────┬──────────────────────────────────────────┤
 * │              │  CONTEXT BAR (40px)                      │
 * │  SIDEBAR     ├──────────────────────────────────────────┤
 * │  (240px /    │                                          │
 * │  56px mini)  │  MAIN CONTENT AREA (scrollable)          │
 * │              │                                          │
 * └──────────────┴──────────────────────────────────────────┘
 *
 * The sidebar width is controlled by the UI store (collapsed state).
 * CSS transitions handle the collapse animation.
 */
export function AppShell({ children }: AppShellProps) {
  const isHydrated = useIsHydrated();
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content column */}
      <div
        className={cn(
          'flex flex-1 flex-col overflow-hidden transition-all duration-slow',
          // Account for sidebar width — sidebar is fixed positioned
          isHydrated && sidebarCollapsed
            ? 'ml-[var(--sidebar-collapsed-width)]'
            : 'ml-[var(--sidebar-width)]',
        )}
      >
        {/* Fixed TopBar */}
        <TopBar />

        {/* Context Bar */}
        <ContextBar />

        {/* Main scrollable content area */}
        <main
          id="main-content"
          className="flex-1 overflow-y-auto"
          role="main"
          aria-label="Main content"
        >
          <div className="min-h-full p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
