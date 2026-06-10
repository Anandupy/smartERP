'use client';

import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { ContextBar } from './ContextBar';
import { useUIStore } from '@/stores/ui.store';

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * AppShell — root layout for all authenticated EduOS pages.
 *
 * Layout grid (per DESIGN_SYSTEM.md):
 *   ┌────────────────────────────────────────────────┐
 *   │  TOPBAR (56px — spans full width)              │
 *   ├──────────────┬─────────────────────────────────┤
 *   │              │  CONTEXT BAR (40px)              │
 *   │  SIDEBAR     ├─────────────────────────────────┤
 *   │  240px/56px  │  MAIN CONTENT (scrollable)      │
 *   │              │                                  │
 *   └──────────────┴─────────────────────────────────┘
 */
export function AppShell({ children }: AppShellProps) {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* ── Sidebar (fixed left, full height) ── */}
      <Sidebar />

      {/* ── Main area (right of sidebar) ── */}
      <div
        className="flex flex-1 flex-col overflow-hidden transition-[margin-left] duration-300"
        style={{
          marginLeft: sidebarCollapsed
            ? 'var(--sidebar-collapsed-width)'
            : 'var(--sidebar-width)',
        }}
      >
        {/* TopBar — fixed at top of content area */}
        <TopBar />

        {/* ContextBar — ERP workspace context breadcrumb */}
        <ContextBar />

        {/* Scrollable page content */}
        <main
          id="main-content"
          className="flex-1 overflow-y-auto overflow-x-hidden bg-surface"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
