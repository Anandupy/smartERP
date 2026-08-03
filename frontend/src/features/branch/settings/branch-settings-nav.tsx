"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ROUTES } from "@/constants";
import { cn } from "@/lib/utils";
import { BackendPendingBadge } from "@/shared/components/feedback";

import { BRANCH_SETTINGS_SECTIONS } from "./settings-sections";

export interface BranchSettingsNavProps {
  branchId: string;
  className?: string;
}

/**
 * Section navigation for Branch Settings.
 *
 * A horizontally scrolling strip on mobile and a vertical rail from `lg` — the
 * same list laid out for the space available, rather than two components that
 * drift. Mirrors `SettingsNav` from System Settings; the difference is that
 * these routes are branch-scoped, so the branch id is threaded through.
 *
 * Sections with no backend contract carry the marker here as well as inside, so
 * the state is visible before the user commits to a click.
 */
export function BranchSettingsNav({
  branchId,
  className,
}: BranchSettingsNavProps) {
  const pathname = usePathname();
  const root = ROUTES.app.branches.settings.root(branchId);

  return (
    <nav
      aria-label="Branch settings sections"
      className={cn(
        "-mx-4 overflow-x-auto px-4 pb-2 lg:mx-0 lg:overflow-visible lg:px-0 lg:pb-0",
        className,
      )}
    >
      <ul className="flex min-w-max gap-1 lg:min-w-0 lg:flex-col">
        <li>
          <Link
            href={root}
            aria-current={pathname === root ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors",
              pathname === root
                ? "bg-secondary text-secondary-foreground font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            Overview
          </Link>
        </li>

        {BRANCH_SETTINGS_SECTIONS.map((section) => {
          const Icon = section.icon;
          const href = section.href(branchId);
          const isActive = pathname === href;

          return (
            <li key={section.id}>
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-secondary text-secondary-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                <span className="truncate">{section.label}</span>
                {section.backendPending ? (
                  <BackendPendingBadge className="ml-auto hidden lg:inline-flex" />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
