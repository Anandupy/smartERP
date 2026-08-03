"use client";

import { useRouter } from "next/navigation";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useUiStore } from "@/store";
import { BackendPendingNote } from "@/shared/components/feedback";

import { NAV_SECTIONS, SEARCH_PLACEHOLDER } from "../constants";

/**
 * Keyboard-first navigation across the app.
 *
 * Wired to the destinations the shell already knows about, which is everything
 * a static menu can honestly offer. Searching *records* — a student, a rule, a
 * log entry — needs a backend search contract that is not documented, so that
 * half is declared pending rather than faked with client-side filtering over
 * whatever a page happens to have loaded.
 *
 * Open state lives in `useUiStore` so anything can raise it: the header's
 * search affordance, ⌘K, and later a help menu, without passing callbacks
 * around the shell.
 */
export function CommandPalette() {
  const router = useRouter();
  const isOpen = useUiStore((state) => state.isCommandMenuOpen);
  const setOpen = useUiStore((state) => state.setCommandMenuOpen);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={setOpen}
      title="Command palette"
      description="Jump to a section of CampusFlow ERP."
    >
      <Command>
        <CommandInput placeholder={SEARCH_PLACEHOLDER} />
        <CommandList>
          <CommandEmpty>No matching destination.</CommandEmpty>

          {NAV_SECTIONS.map((section) => {
            const items = section.items.filter((item) => !item.comingSoon);
            if (items.length === 0) return null;

            return (
              <CommandGroup
                key={section.id}
                heading={section.label ?? undefined}
              >
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <CommandItem
                      key={item.id}
                      value={`${item.label} ${item.description ?? ""}`}
                      onSelect={() => go(item.href)}
                    >
                      <Icon aria-hidden="true" />
                      <span>{item.label}</span>
                      {item.description ? (
                        <span className="text-muted-foreground ml-auto text-xs">
                          {item.description}
                        </span>
                      ) : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            );
          })}

          <CommandSeparator />
          <div className="px-3 py-2">
            <BackendPendingNote>
              searching records (students, rules, log entries) needs a backend
              search endpoint, which is not documented yet.
            </BackendPendingNote>
          </div>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
