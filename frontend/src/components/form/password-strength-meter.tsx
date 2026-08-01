"use client";

import { Check, X } from "@/assets/icons";
import { Progress } from "@/components/ui/progress";
import { getPasswordStrength, type PasswordStrengthLevel } from "@/lib";
import { cn } from "@/lib/utils";

export interface PasswordStrengthMeterProps {
  /** The password being typed. */
  value: string;
  /** Render the per-rule checklist under the meter. */
  showChecklist?: boolean;
  className?: string;
}

const LEVEL_BAR: Record<PasswordStrengthLevel, string> = {
  empty: "[&>[data-slot=progress-indicator]]:bg-muted-foreground/30",
  weak: "[&>[data-slot=progress-indicator]]:bg-destructive",
  fair: "[&>[data-slot=progress-indicator]]:bg-chart-4",
  good: "[&>[data-slot=progress-indicator]]:bg-chart-2",
  strong: "[&>[data-slot=progress-indicator]]:bg-primary",
};

/**
 * Determinate strength meter plus the requirements checklist, both derived from
 * the single password policy in `lib/password-strength`.
 *
 * The meter is decorative — the checklist carries the same information as text
 * and is the accessible source of truth, announced politely so a screen-reader
 * user hears requirements being met as they type rather than only on submit.
 */
export function PasswordStrengthMeter({
  value,
  showChecklist = true,
  className,
}: PasswordStrengthMeterProps) {
  const strength = getPasswordStrength(value);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="space-y-1.5">
        <Progress
          value={strength.score}
          aria-hidden="true"
          className={cn("h-1.5", LEVEL_BAR[strength.level])}
        />
        <p className="text-muted-foreground text-xs">
          Password strength:{" "}
          <span className="text-foreground font-medium">{strength.label}</span>
        </p>
      </div>

      {showChecklist ? (
        <ul aria-live="polite" className="space-y-1.5">
          {strength.results.map((rule) => (
            <li
              key={rule.id}
              className={cn(
                "flex items-center gap-2 text-xs",
                rule.satisfied ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {rule.satisfied ? (
                <Check aria-hidden="true" className="text-primary size-3.5" />
              ) : (
                <X aria-hidden="true" className="size-3.5 opacity-50" />
              )}
              <span>{rule.label}</span>
              <span className="sr-only">
                {rule.satisfied ? "— met" : "— not met"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
