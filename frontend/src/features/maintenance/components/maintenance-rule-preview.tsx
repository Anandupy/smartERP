"use client";

import { Ban, CircleCheckBig, Eye } from "@/assets/icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/shared/components/data-display";
import { cn } from "@/lib/utils";

import { DAY_OF_WEEK_OPTIONS, SCOPE_PRESENTATION } from "../constants";
import type { MaintenanceRuleFormValues } from "../schemas/maintenance-rule.schema";
import { MaintenanceBanner } from "./maintenance-banner";

export interface MaintenanceRulePreviewProps {
  values: MaintenanceRuleFormValues;
  className?: string;
}

/** One allow-flag, drawn as what it permits rather than as a boolean. */
function AccessRow({ allowed, label }: { allowed: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {allowed ? (
        <CircleCheckBig
          aria-hidden="true"
          className="text-chart-2 size-4 shrink-0"
        />
      ) : (
        <Ban aria-hidden="true" className="text-destructive size-4 shrink-0" />
      )}
      <span className={allowed ? "text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
      <span className="sr-only">{allowed ? "allowed" : "blocked"}</span>
    </li>
  );
}

/**
 * What this rule will do, rendered from the form as it is being filled in.
 *
 * Entirely local — no request, no saved state — so an operator can see the
 * consequence of a scope and three switches before committing them. That
 * matters more here than on most forms: the thing being configured is whether
 * people can use the system, and the cost of finding out afterwards is that
 * nobody can reach the screen to undo it.
 *
 * The notice at the top is the same `MaintenanceBanner` the live status renders,
 * so the preview is not an approximation of the real thing — it is the real
 * thing, with unsaved values.
 */
export function MaintenanceRulePreview({
  values,
  className,
}: MaintenanceRulePreviewProps) {
  const scope = SCOPE_PRESENTATION[values.scopeType];
  const ScopeIcon = scope.icon;

  const day = DAY_OF_WEEK_OPTIONS.find(
    (option) => option.value === values.recurrenceDayOfWeek,
  );

  const schedule = values.isRecurring
    ? day && values.recurrenceStartTime && values.recurrenceEndTime
      ? `Every ${day.label}, ${values.recurrenceStartTime}–${values.recurrenceEndTime} (${values.timezone})`
      : "Weekly window — not fully specified"
    : values.startAt || values.endAt
      ? [
          values.startAt ? `From ${values.startAt.replace("T", " ")}` : null,
          values.endAt ? `until ${values.endAt.replace("T", " ")}` : null,
        ]
          .filter(Boolean)
          .join(" ")
      : "Applies immediately, with no end";

  return (
    <Card className={cn("h-fit", className)}>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Eye aria-hidden="true" className="size-4" />
          Preview
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        {values.isActive ? (
          <MaintenanceBanner
            title={values.title || null}
            message={values.shortMessage || values.description || null}
            scopeLabel={scope.label}
            detailsHref={values.customPage || null}
            severity={values.severity || null}
          />
        ) : (
          <p className="text-muted-foreground text-sm">
            The rule is inactive, so nothing is shown to users.
          </p>
        )}

        <div className="space-y-1">
          <p className="text-muted-foreground text-xs tracking-wide uppercase">
            Scope
          </p>
          <div className="flex items-center gap-2 text-sm">
            <ScopeIcon aria-hidden="true" className="size-4 shrink-0" />
            <span>{scope.label}</span>
            {values.scopeType !== "GLOBAL" && values.scopeId ? (
              <code className="bg-muted rounded px-1 py-0.5 text-xs break-all">
                {values.scopeId}
              </code>
            ) : null}
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-muted-foreground text-xs tracking-wide uppercase">
            While it applies
          </p>
          <ul className="space-y-1">
            <AccessRow allowed={values.allowLogin} label="Sign-in" />
            <AccessRow allowed={values.allowReadApis} label="Reading data" />
            <AccessRow allowed={values.allowWriteApis} label="Saving changes" />
          </ul>
          <p className="text-muted-foreground text-xs">
            Blocked requests receive HTTP {values.customStatus}.
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-muted-foreground text-xs tracking-wide uppercase">
            When
          </p>
          <p className="text-sm">{schedule}</p>
        </div>

        <div className="space-y-1">
          <p className="text-muted-foreground text-xs tracking-wide uppercase">
            Who gets through
          </p>
          <div className="flex flex-wrap gap-1">
            <StatusBadge tone="brand">SUPER_ADMIN</StatusBadge>
            {values.bypassRoles
              .split(",")
              .map((role) => role.trim())
              .filter(Boolean)
              .map((role) => (
                <StatusBadge key={role} tone="info">
                  {role}
                </StatusBadge>
              ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
