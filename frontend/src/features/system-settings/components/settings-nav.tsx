"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ROUTES } from "@/constants";
import { cn } from "@/lib/utils";
import { BackendPendingBadge } from "@/shared/components/feedback";

import { SETTINGS_SECTIONS } from "../constants";

export interface SettingsNavProps {
  className?: string;
}

/**
 * Section navigation for System Settings.
 *
 * A horizontally scrolling strip on mobile and a vertical rail from `lg` — the
 * same list, laid out for the space available, rather than two components that
 * drift. Reads `SETTINGS_SECTIONS`, so it and the dashboard grid always offer
 * the same sections.
 */
export function SettingsNav({ className }: SettingsNavProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Settings sections"
      className={cn(
        "-mx-4 overflow-x-auto px-4 pb-2 lg:mx-0 lg:overflow-visible lg:px-0 lg:pb-0",
        className,
      )}
    >
      <ul className="flex min-w-max gap-1 lg:min-w-0 lg:flex-col">
        <li>
          <Link
            href={ROUTES.app.settings.root}
            aria-current={
              pathname === ROUTES.app.settings.root ? "page" : undefined
            }
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors",
              pathname === ROUTES.app.settings.root
                ? "bg-secondary text-secondary-foreground font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            Overview
          </Link>
        </li>

        {SETTINGS_SECTIONS.map((section) => {
          const Icon = section.icon;
          const isActive = pathname === section.href;

          return (
            <li key={section.id}>
              <Link
                href={section.href}
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
