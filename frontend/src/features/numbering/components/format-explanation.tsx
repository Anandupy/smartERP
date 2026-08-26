import { FORMAT_PLACEHOLDERS } from "../constants";

/**
 * Documents the supported placeholder vocabulary beneath the format field —
 * a UX/documentation layer only, not a new business rule. Every row comes
 * from `FORMAT_PLACEHOLDERS`, the same list the field's validation and the
 * insertable chips use, so this can never describe a placeholder the form
 * does not actually accept.
 */
export function FormatExplanation() {
  return (
    <div className="border-border bg-muted/30 space-y-2 rounded-lg border p-3">
      <p className="text-foreground text-xs font-medium">How this format works</p>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
        {FORMAT_PLACEHOLDERS.map((placeholder) => (
          <div key={placeholder.token} className="flex items-baseline gap-2 text-xs">
            <dt className="text-primary shrink-0 font-mono">{placeholder.token}</dt>
            <dd className="text-muted-foreground">{placeholder.description}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
