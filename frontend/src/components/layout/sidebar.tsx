'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GraduationCap, ChevronLeft, ChevronRight } from 'lucide-react';
import { useUIStore } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';
import { useIsHydrated } from '@/hooks/use-is-hydrated';
import { NAV_ITEMS } from '@/config/navigation';
import { cn } from '@/lib/utils/cn';
import type { NavItem } from '@/types/ui.types';
import type { UserRole } from '@/types/domain.types';

// ── Nav Item Component ────────────────────────────────────────

interface NavItemComponentProps {
  item: NavItem;
  collapsed: boolean;
  currentPath: string;
}

function NavItemComponent({ item, collapsed, currentPath }: NavItemComponentProps) {
  const Icon = item.icon;
  const isActive =
    item.href === '/dashboard'
      ? currentPath === item.href
      : currentPath.startsWith(item.href);

  if (item.isDisabled || item.isComingSoon) {
    return (
      <div
        title={collapsed ? item.label : undefined}
        className={cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm',
          'cursor-not-allowed opacity-40',
          'text-muted-erp',
        )}
        aria-disabled
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        {!collapsed && (
          <span className="flex-1 truncate">{item.label}</span>
        )}
        {!collapsed && item.isComingSoon && (
          <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted-erp">
            Soon
          </span>
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
        'group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isActive
          ? 'bg-primary text-primary-foreground font-medium'
          : 'text-muted-erp hover:bg-surface-2 hover:text-foreground',
      )}
    >
      <Icon
        className={cn(
          'h-4 w-4 shrink-0 transition-transform',
          isActive && 'text-primary-foreground',
        )}
        aria-hidden
      />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge !== undefined && (
            <span
              className={cn(
                'ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                isActive
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'bg-surface-2 text-muted-erp',
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

// ── Sidebar ───────────────────────────────────────────────────

/**
 * Sidebar navigation component.
 *
 * Features:
 * - Collapsible (icon-only) mode
 * - Role-based nav item filtering
 * - Active state highlighting
 * - Smooth collapse/expand transition
 * - ARIA navigation landmark
 * - Keyboard accessible
 */
export function Sidebar() {
  const isHydrated = useIsHydrated();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const role = useAuthStore((s) => s.role);
  const pathname = usePathname();

  // During SSR and hydration, show expanded sidebar
  const collapsed = isHydrated ? sidebarCollapsed : false;

  // Filter nav items by user role
  const filteredItems = NAV_ITEMS.filter(
    (item) => !role || item.roles.includes(role as UserRole),
  );

  return (
    <aside
      role="navigation"
      aria-label="Main navigation"
      className={cn(
        'fixed left-0 top-0 z-30 flex h-full flex-col border-r border-erp bg-background',
        'sidebar-transition',
        collapsed
          ? 'w-[var(--sidebar-collapsed-width)]'
          : 'w-[var(--sidebar-width)]',
      )}
    >
      {/* Logo / Brand */}
      <div
        className={cn(
          'flex h-[var(--topbar-height)] shrink-0 items-center border-b border-erp px-3',
          collapsed ? 'justify-center' : 'gap-2.5 px-4',
        )}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <GraduationCap className="h-4 w-4" aria-hidden />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              EduOS
            </p>
            <p className="truncate text-[10px] text-muted-erp">
              ERP Platform
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2 pt-3">
        <ul className="space-y-0.5" role="list">
          {filteredItems.map((item) => (
            <li key={item.href}>
              <NavItemComponent
                item={item}
                collapsed={collapsed}
                currentPath={pathname}
              />
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom Actions */}
      <div className="shrink-0 border-t border-erp p-2">
        {/* Collapse Toggle */}
        <button
          onClick={toggleSidebar}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm',
            'text-muted-erp transition-colors hover:bg-surface-2 hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            collapsed && 'justify-center',
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
