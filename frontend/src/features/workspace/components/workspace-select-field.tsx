"use client";

import type { LucideIcon } from "@/assets/icons";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { WorkspaceEntity } from "@/core/workspace";

export interface WorkspaceSelectFieldProps {
  /** Unique within the form; drives the label/trigger association. */
  id: string;
  label: string;
  /** Leading glyph, purely decorative. */
  icon: LucideIcon;
  placeholder: string;
  /** Shown instead of the placeholder when there is nothing to choose from. */
  emptyPlaceholder: string;
  value: string | null;
  options: readonly WorkspaceEntity[];
  onChange: (id: string) => void;
}

/**
 * One level of the workspace choice, rendered as a select.
 *
 * Organization and academic year are the same control with different data, so
 * they share one component — the campus step differs (it shows richer detail
 * per option) and has its own.
 *
 * ## Accessible naming
 *
 * The trigger is a `button`, which `<label for>` alone does not name reliably.
 * `aria-labelledby` lists the label *and the trigger itself*, so the accessible
 * name resolves to "Organization, Universal Educational Trust" — the field and
 * its current answer — instead of one or the other.
 *
 * With no options the control is disabled rather than hidden: a campus step
 * that vanishes reads as a bug, whereas a disabled one that says why does not.
 */
export function WorkspaceSelectField({
  id,
  label,
  icon: Icon,
  placeholder,
  emptyPlaceholder,
  value,
  options,
  onChange,
}: WorkspaceSelectFieldProps) {
  const labelId = `${id}-label`;
  const isEmpty = options.length === 0;

  return (
    <div className="space-y-2">
      <Label id={labelId} htmlFor={id}>
        {label}
      </Label>
      <Select value={value ?? ""} onValueChange={onChange} disabled={isEmpty}>
        <SelectTrigger
          id={id}
          aria-labelledby={`${labelId} ${id}`}
          className="min-h-14 h-auto w-full py-2.5 pl-2.5"
        >
          <span className="flex min-w-0 flex-1 items-center gap-3">
            <span
              aria-hidden="true"
              className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg"
            >
              <Icon className="size-4" />
            </span>
            <SelectValue
              placeholder={isEmpty ? emptyPlaceholder : placeholder}
              className="min-w-0"
            />
          </span>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              <span className="flex min-w-0 flex-col items-start gap-0.5">
                <span className="text-foreground truncate text-sm font-medium">
                  {option.name}
                </span>
                {option.code ? (
                  <span className="text-muted-foreground truncate text-xs">
                    {option.code}
                  </span>
                ) : null}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
