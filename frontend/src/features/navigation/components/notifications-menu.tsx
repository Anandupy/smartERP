"use client";

import { Bell } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BackendPendingBadge, EmptyState } from "@/shared/components/feedback";

/**
 * Notification bell.
 *
 * A placeholder by design: the notification feed is not part of this
 * milestone's contract, so the menu shows an honest empty state rather than
 * inventing a payload. Nothing here implies unread activity — no dot, no count
 * — because a badge over an unwired feed is a false alarm.
 *
 * The shape it will take is already right: a trigger, a labelled panel, and a
 * list region that becomes the feed when the contract lands.
 */
export function NotificationsMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Notifications"
        >
          <Bell />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          Notifications
          <BackendPendingBadge />
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <EmptyState
          icon={Bell}
          title="Nothing yet"
          description="Notifications will appear here once the feed is connected."
          className="min-h-32 border-none p-4"
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
