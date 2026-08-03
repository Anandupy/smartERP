"use client";

import { useEffect } from "react";

import { Search } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { useMounted } from "@/hooks";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store";

import { SEARCH_PLACEHOLDER } from "../constants";

/**
 * Whether the platform's modifier key should be drawn as ⌘ or Ctrl.
 *
 * Derived from `useMounted` rather than an effect: the server has no idea what
 * the visitor is typing on, so it renders the neutral label and the client
 * settles on the real one in the same pass that hydration completes — no
 * cascading render, and no mismatch warning.
 */
function useCommandKeyLabel(): string {
  const isMounted = useMounted();

  if (!isMounted) return "Ctrl";
  return /mac|iphone|ipad/i.test(navigator.userAgent) ? "⌘" : "Ctrl";
}

export interface GlobalSearchProps {
  className?: string;
}

/**
 * The header's search affordance.
 *
 * A button, not an input — typing into a box that cannot answer would be a
 * worse lie than a control that opens the palette and says what it can do.
 * It raises `CommandPalette`, which navigates today and will search records
 * once a backend search contract exists.
 *
 * Collapses to an icon below `sm`, where a 20rem search bar cannot coexist
 * with the rest of the header.
 */
export function GlobalSearch({ className }: GlobalSearchProps) {
  const setCommandMenuOpen = useUiStore((state) => state.setCommandMenuOpen);
  const commandKey = useCommandKeyLabel();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setCommandMenuOpen(true);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setCommandMenuOpen]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Search"
        className={cn("sm:hidden", className)}
        onClick={() => setCommandMenuOpen(true)}
      >
        <Search />
      </Button>

      <Button
        type="button"
        variant="outline"
        className={cn(
          "text-muted-foreground hidden w-56 justify-start gap-2 font-normal sm:inline-flex lg:w-72",
          className,
        )}
        onClick={() => setCommandMenuOpen(true)}
      >
        <Search aria-hidden="true" />
        <span className="truncate">{SEARCH_PLACEHOLDER}</span>
        <kbd className="bg-muted text-muted-foreground ml-auto hidden rounded px-1.5 py-0.5 font-sans text-[0.7rem] lg:inline-block">
          {commandKey} K
        </kbd>
      </Button>
    </>
  );
}
