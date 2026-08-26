import { ArrowDown } from "@/assets/icons";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { FORMAT_PLACEHOLDERS, YEAR_FORMAT_EXAMPLE } from "../constants";
import type { NumberingYearFormat } from "../types/numbering.dto";

interface FormatSegment {
  type: "literal" | "token";
  value: string;
}

/** Splits a format string into its literal text and `{placeholder}` segments, in order. */
export function parseFormatSegments(format: string): FormatSegment[] {
  return format
    .split(/(\{[^}]*\})/g)
    .filter((part) => part.length > 0)
    .map((part) =>
      part.startsWith("{") && part.endsWith("}")
        ? { type: "token" as const, value: part }
        : { type: "literal" as const, value: part },
    );
}

type SampleKind = "value" | "example" | "runtime";

/**
 * What each placeholder's chip shows. `"value"` is a real, currently
 * configured value (prefix/suffix as typed, or a zero string the width of
 * `sequencePadding`) — never a claimed generated number. `"example"` reuses
 * `YEAR_FORMAT_EXAMPLE`, already documented elsewhere as illustrative only.
 * `"runtime"` names what the placeholder resolves to without inventing a
 * value this module cannot know (a branch's actual code).
 */
function sampleFor(
  token: string,
  ctx: {
    prefix?: string | null;
    suffix?: string | null;
    sequencePadding?: number;
    yearFormat: NumberingYearFormat;
  },
): { kind: SampleKind; text: string } {
  switch (token) {
    case "{prefix}": {
      const value = ctx.prefix?.trim();
      return value ? { kind: "value", text: value } : { kind: "runtime", text: "not set" };
    }
    case "{suffix}": {
      const value = ctx.suffix?.trim();
      return value ? { kind: "value", text: value } : { kind: "runtime", text: "not set" };
    }
    case "{sequence}": {
      const width = Math.max(ctx.sequencePadding ?? 1, 1);
      return { kind: "value", text: "0".repeat(width) };
    }
    case "{year}":
      return { kind: "example", text: YEAR_FORMAT_EXAMPLE[ctx.yearFormat] };
    case "{branchCode}":
      return { kind: "runtime", text: "set by branch" };
    default:
      return { kind: "runtime", text: token };
  }
}

const SAMPLE_TONE: Record<SampleKind, string> = {
  value: "border-primary/30 bg-primary/5 text-foreground font-medium",
  example: "border-border border-dashed text-muted-foreground italic",
  runtime: "border-border border-dashed text-muted-foreground/80 italic",
};

export interface FormatBreakdownProps {
  format: string;
  prefix?: string | null;
  suffix?: string | null;
  sequencePadding?: number;
  yearFormat?: NumberingYearFormat;
  /**
   * `"full"` renders a stacked chip per placeholder (sample → arrow →
   * placeholder name) — for the create/edit form and the edit screen's
   * configuration summary. `"compact"` renders one inline row of labelled
   * badges — for table cells, where the full visual is too tall.
   */
  variant?: "full" | "compact";
  className?: string;
}

/**
 * Visualizes a format string as the segments that build it.
 *
 * This is a structural explainer, not a generated identifier — it never
 * fabricates a branch code, an academic year, or a specific sequence value.
 * The one real generated example only ever comes from the backend's own
 * Preview endpoint (`NumberingPreviewPanel`).
 */
export function FormatBreakdown({
  format,
  prefix,
  suffix,
  sequencePadding,
  yearFormat = "NAME",
  variant = "full",
  className,
}: FormatBreakdownProps) {
  const segments = parseFormatSegments(format);
  const tokens = segments.filter((segment) => segment.type === "token");

  if (tokens.length === 0) {
    return (
      <p className={cn("text-muted-foreground text-xs", className)}>
        This format has no placeholders yet.
      </p>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cn("flex flex-wrap gap-1", className)}>
        {tokens.map((segment, index) => {
          const meta = FORMAT_PLACEHOLDERS.find((p) => p.token === segment.value);
          return (
            <Badge key={`${segment.value}-${index}`} variant="outline" className="font-normal">
              {meta?.label ?? segment.value}
            </Badge>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-start gap-x-1.5 gap-y-3", className)}>
      {segments.map((segment, index) => {
        if (segment.type === "literal") {
          return segment.value.trim().length > 0 ? (
            <span
              key={index}
              className="text-muted-foreground self-center px-0.5 font-mono text-sm"
            >
              {segment.value}
            </span>
          ) : null;
        }

        const meta = FORMAT_PLACEHOLDERS.find((p) => p.token === segment.value);
        const sample = sampleFor(segment.value, { prefix, suffix, sequencePadding, yearFormat });

        return (
          <div key={index} className="flex flex-col items-center gap-1">
            <span
              className={cn(
                "rounded-md border px-2 py-1 font-mono text-sm whitespace-nowrap",
                SAMPLE_TONE[sample.kind],
              )}
            >
              {sample.text}
            </span>
            <ArrowDown aria-hidden="true" className="text-muted-foreground/50 size-3" />
            <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
              {meta?.label ?? segment.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}
