'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight, GraduationCap } from 'lucide-react';
import { useUIStore } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';
import { useIsHydrated } from '@/hooks/use-is-hydrated';
import { getNavSections } from '@/config/navigation';
import { cn } from '@/lib/utils';
import type { NavItem, NavSection } from '@/config/navigation';
import type { UserRole } from '@/types/domain.types';

// ── Nav Item ──────────────────────────────────────────────────

function SidebarNavItem({
  item,
  collapsed,
  depth = 0,
}: {
  item: NavItem;
  collapsed: boolean;
  depth?: number;
}) {
  const pathname = usePathname();
  const isActive =
    item.href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname.startsWith(item.href) && item.href !== '/';

  // Disabled / coming-soon state
  if (item.isDisabled || item.isComingSoon) {
    return (
      <div
        title={collapsed ? item.label : undefined}
        className={cn(
          'group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px]',
          'cursor-not-allowed opacity-40',
          depth > 0 && 'ml-4 pl-3',
        )}
        aria-disabled
      >
        <item.icon
          className="h-[15px] w-[15px] shrink-0 text-text-muted"
          aria-hidden
        />
        {!collapsed && (
          <>
            <span className="flex-1 truncate text-text-muted">{item.label}</span>
            {item.isComingSoon && (
              <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
                Soon
              </span>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px]',
        'transition-colors duration-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        depth > 0 && 'ml-4 pl-3',
        isActive
          ? 'bg-primary text-primary-foreground font-medium'
          : 'text-text-secondary hover:bg-surface-2 hover:text-foreground',
        collapsed && 'justify-center px-0',
      )}
    >
      <item.icon
        className={cn(
          'h-[15px] w-[15px] shrink-0',
          isActive ? 'text-primary-foreground' : 'text-text-muted group-hover:text-foreground',
        )}
        aria-hidden
      />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {typeof item.badge !== 'undefined' && (
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                isActive
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'bg-surface-2 text-text-muted',
              )}
            >
              {item.badge}
            </span>
          )}
        </>
      )}
    </Link>
  );
}

// ── Nav Section ───────────────────────────────────────────────

function SidebarSection({
  section,
  collapsed,
  isFirst,
}: {
  section: NavSection;
  collapsed: boolean;
  isFirst: boolean;
}) {
  return (
    <div className={cn(!isFirst && 'mt-1')}>
      {/* Section label — only when expanded */}
      {section.label && !collapsed && (
        <div className="mb-1 mt-3 px-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            {section.label}
          </span>
        </div>
      )}

      {/* Divider when collapsed */}
      {section.label && collapsed && !isFirst && (
        <div className="mx-auto mb-1 mt-2 h-px w-8 bg-border" />
      )}

      {/* Items */}
      <ul className="space-y-0.5" role="list">
        {section.items.map((item) => (
          <li key={item.id}>
            <SidebarNavItem item={item} collapsed={collapsed} />
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────

/**
 * Sidebar — primary navigation.
 *
 * Features:
 * - Config-driven (NAV_SECTIONS) with plugin extension support
 * - Grouped sections with labels
 * - Collapsible to icon-only (56px)
 * - Role-based item filtering
 * - Active state via URL matching
 * - ARIA navigation landmark
 */
export function Sidebar() {
  const isHydrated = useIsHydrated();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const role = useAuthStore((s) => s.role);

  // Use expanded during SSR to prevent layout shift
  const collapsed = isHydrated ? sidebarCollapsed : false;

  const sections = getNavSections(role as UserRole | null);

  return (
    <aside
      role="navigation"
      aria-label="Main navigation"
      className={cn(
        'fixed inset-y-0 left-0 z-30 flex flex-col',
        'border-r border-border bg-background',
        'sidebar-transition',
        collapsed ? 'w-[var(--sidebar-collapsed-width)]' : 'w-[var(--sidebar-width)]',
      )}
    >
      {/* ── Logo / Brand ── */}
      <div
        className={cn(
          'flex h-[var(--topbar-height)] shrink-0 items-center border-b border-border',
          collapsed ? 'justify-center px-0' : 'gap-2.5 px-4',
        )}
      >
        {/* Logo icon */}
        <div
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
            'bg-primary text-primary-foreground',
          )}
        >
          <GraduationCap className="h-[15px] w-[15px]" aria-hidden />
        </div>

        {/* Brand text — hidden when collapsed */}
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold tracking-tight text-foreground">
              EduOS
            </p>
            <p className="truncate text-[10px] text-text-muted">ERP Platform</p>
          </div>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav
        className={cn(
          'flex-1 overflow-y-auto overflow-x-hidden',
          collapsed ? 'px-1.5 py-2' : 'px-2 py-2',
        )}
      >
        {sections.map((section, index) => (
          <SidebarSection
            key={section.id}
            section={section}
            collapsed={collapsed}
            isFirst={index === 0}
          />
        ))}
      </nav>

      {/* ── Bottom — Collapse Toggle ── */}
      <div className="shrink-0 border-t border-border p-2">
        <button
          onClick={toggleSidebar}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px]',
            'text-text-muted transition-colors hover:bg-surface-2 hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            collapsed && 'justify-center px-0',
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-[15px] w-[15px] shrink-0" aria-hidden />
          ) : (
            <>
              <ChevronLeft className="h-[15px] w-[15px] shrink-0" aria-hidden />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
