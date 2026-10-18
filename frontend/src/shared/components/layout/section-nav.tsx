"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import type { LucideIcon } from "@/assets/icons";
import { cn } from "@/lib/utils";
import { BackendPendingBadge } from "@/shared/components/feedback";

export interface SectionNavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Marks a section whose backend contract is not yet available. */
  backendPending?: boolean;
  /**
   * `prefix` (default) keeps the item active on its nested routes —
   * `/settings/numbering/new` stays under Numbering. `exact` is for an
   * overview whose path is every other item's prefix.
   */
  match?: "prefix" | "exact";
}

export interface SectionNavProps {
  /** Accessible name of the navigation landmark, e.g. "Security sections". */
  label: string;
  items: readonly SectionNavItem[];
  className?: string;
}

export function isSectionActive(item: SectionNavItem, pathname: string) {
  if (pathname === item.href) return true;
  return (item.match ?? "prefix") === "prefix"
    ? pathname.startsWith(`${item.href}/`)
    : false;
}

/**
 * A module's own section navigation, beside the main sidebar — a vertical
 * list from `lg` up, a horizontally scrolling row below it.
 *
 * Driven entirely by the URL: the active item is whichever matches the
 * current path, so there is no navigation state to keep in sync. Labels are
 * never truncated — a backend-pending section carries the compact marker
 * rather than the full pill, which is what used to squeeze "Two-Factor
 * Authentication" to "Two-Fa…". On a narrow screen the active item is
 * scrolled into view.
 */
export function SectionNav({ label, items, className }: SectionNavProps) {
  const pathname = usePathname();
  const activeRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    // `scrollIntoView` is absent in some test environments; nothing depends on it.
    activeRef.current?.scrollIntoView?.({
      block: "nearest",
      inline: "nearest",
    });
  }, [pathname]);

  return (
    <nav
      aria-label={label}
      className={cn(
        "-mx-4 overflow-x-auto px-4 pb-2 lg:mx-0 lg:overflow-visible lg:px-0 lg:pb-0",
        className,
      )}
    >
      <ul className="flex min-w-max gap-1 lg:min-w-0 lg:flex-col">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = isSectionActive(item, pathname);

          return (
            <li key={item.id}>
              <Link
                ref={isActive ? activeRef : undefined}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-ring/50 flex min-h-9 items-center gap-2.5 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] lg:whitespace-normal",
                  isActive
                    ? "bg-secondary text-secondary-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                <span className="min-w-0 flex-1">{item.label}</span>
                {item.backendPending ? <BackendPendingBadge compact /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export interface SectionLayoutProps {
  nav: React.ReactNode;
  children: React.ReactNode;
}

/**
 * The two-column frame for a module with section navigation: the nav beside
 * the content from `lg` up (one width for every module), stacked above it
 * below. Content gets `min-w-0` so a wide table scrolls inside its own
 * container instead of widening the page.
 */
export function SectionLayout({ nav, children }: SectionLayoutProps) {
  return (
    <div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8">
      <div className="lg:sticky lg:top-20 lg:self-start">{nav}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
