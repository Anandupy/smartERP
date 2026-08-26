import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { FORMAT_PLACEHOLDERS } from "../constants";

export interface FormatPlaceholderChipsProps {
  onInsert: (token: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Selectable chips for the format field's supported placeholder vocabulary.
 * A UX helper only — clicking one appends the token to the current format
 * value; the field's own Zod validation (`numberingConfigFormSchema`, driven
 * by the same `FORMAT_PLACEHOLDERS` list) still governs what is accepted, so
 * a chip can never bypass a rule the backend also enforces.
 */
export function FormatPlaceholderChips({
  onInsert,
  disabled,
  className,
}: FormatPlaceholderChipsProps) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)} role="group" aria-label="Insert a placeholder">
      {FORMAT_PLACEHOLDERS.map((placeholder) => (
        <Button
          key={placeholder.token}
          type="button"
          variant="outline"
          size="sm"
          className="h-7 rounded-full px-2.5 font-mono text-xs"
          disabled={disabled}
          onClick={() => onInsert(placeholder.token)}
          title={placeholder.description}
        >
          {placeholder.token}
        </Button>
      ))}
    </div>
  );
}
