"use client";

import { Check, School } from "@/assets/icons";
import type { WorkspaceBranch } from "@/core/workspace";
import { cn } from "@/lib/utils";

export interface WorkspaceBranchFieldProps {
  label: string;
  /** Explains the disabled state when no organization has been chosen yet. */
  emptyHint: string;
  value: string | null;
  options: readonly WorkspaceBranch[];
  onChange: (id: string) => void;
}

/**
 * The campus step, rendered as selectable cards rather than a list.
 *
 * A campus is the choice with the most consequence on this screen — it decides
 * which students, staff and fees the user is about to work with — so it gets
 * room to show what distinguishes one option from another, instead of
 * collapsing to a single line of text in a dropdown.
 *
 * ## Why native radios
 *
 * Each card is a `<label>` wrapping a visually hidden `<input type="radio">`.
 * That buys roving focus, arrow-key navigation between options, form
 * semantics and the correct "2 of 3 selected" announcement from the platform
 * itself — none of which a grid of `<button>`s would have without
 * re-implementing them. The `<fieldset>`/`<legend>` names the group.
 *
 * The focus ring is drawn on the card via `has-[:focus-visible]`, so what the
 * user sees tracks the hidden input that actually holds focus.
 */
export function WorkspaceBranchField({
  label,
  emptyHint,
  value,
  options,
  onChange,
}: WorkspaceBranchFieldProps) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm leading-none font-medium">{label}</legend>

      {options.length === 0 ? (
        <p className="border-border text-muted-foreground rounded-xl border border-dashed p-4 text-sm">
          {emptyHint}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {options.map((branch) => {
            const selected = branch.id === value;
            return (
              <label
                key={branch.id}
                className={cn(
                  "border-border relative flex cursor-pointer flex-col gap-3 rounded-xl border p-4 transition-colors",
                  "has-[:focus-visible]:ring-ring/50 has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3",
                  selected
                    ? "border-primary bg-primary/5"
                    : "hover:border-input hover:bg-muted/50",
                )}
              >
                <input
                  type="radio"
                  name="workspace-branch"
                  value={branch.id}
                  checked={selected}
                  onChange={() => onChange(branch.id)}
                  className="sr-only"
                />

                <div className="flex items-start justify-between gap-2">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg",
                      selected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <School className="size-4" />
                  </span>
                  {selected ? (
                    <Check
                      aria-hidden="true"
                      className="text-primary size-4 shrink-0"
                    />
                  ) : null}
                </div>

                <div className="min-w-0 space-y-0.5">
                  <span className="text-foreground block truncate text-sm font-medium">
                    {branch.name}
                  </span>
                  {branch.code ? (
                    <span className="text-muted-foreground block truncate text-xs">
                      {branch.code}
                    </span>
                  ) : null}
                </div>
              </label>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
