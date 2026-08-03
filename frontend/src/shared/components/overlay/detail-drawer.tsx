"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface DetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  /** Supporting line beneath the title. Also the dialog's accessible description. */
  description?: React.ReactNode;
  /** Slot between the header and the scrolling body (badges, tabs). */
  toolbar?: React.ReactNode;
  /** Pinned controls at the bottom; stays visible while the body scrolls. */
  footer?: React.ReactNode;
  /** Widens the panel for dense records. */
  size?: "default" | "wide";
  children: React.ReactNode;
  className?: string;
}

const SIZE: Record<NonNullable<DetailDrawerProps["size"]>, string> = {
  default: "sm:max-w-md",
  wide: "sm:max-w-xl lg:max-w-2xl",
};

/**
 * Side panel for inspecting one record without leaving the list behind it.
 *
 * A drawer rather than a route because the list is the context: closing it
 * must restore the exact scroll position, filters and page the user was on,
 * which a navigation round-trip does not guarantee.
 *
 * Only the body scrolls — header and footer stay pinned, so the close control
 * and any actions remain reachable in a long record. The panel is full-width
 * on mobile and capped from `sm` up.
 */
export function DetailDrawer({
  open,
  onOpenChange,
  title,
  description,
  toolbar,
  footer,
  size = "default",
  children,
  className,
}: DetailDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "w-full gap-0 data-[side=right]:w-full",
          SIZE[size],
          className,
        )}
      >
        <SheetHeader className="border-border shrink-0 border-b pr-12">
          <SheetTitle>{title}</SheetTitle>
          {description ? (
            <SheetDescription>{description}</SheetDescription>
          ) : null}
        </SheetHeader>

        {toolbar ? (
          <div className="border-border shrink-0 border-b px-4 py-3">
            {toolbar}
          </div>
        ) : null}

        <ScrollArea className="min-h-0 flex-1">
          <div className="p-4">{children}</div>
        </ScrollArea>

        {footer ? (
          <SheetFooter className="border-border shrink-0 flex-row justify-end border-t">
            {footer}
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
