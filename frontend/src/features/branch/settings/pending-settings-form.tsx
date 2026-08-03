"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { BackendPendingNote } from "@/shared/components/feedback";

/** One control in a pending settings group. */
export interface PendingField {
  /** The label the design shows. Also the control's accessible name. */
  label: string;
  /** What the field would hold, shown as placeholder text. */
  placeholder?: string;
  /** Supporting copy beneath the control. */
  description?: string;
  kind?: "text" | "textarea" | "select" | "switch";
  /** Spans the full width of the group. */
  wide?: boolean;
}

export interface PendingSettingsGroupProps {
  title: string;
  /** What this group would configure, in the user's terms. */
  description?: string;
  fields: PendingField[];
  /** Names exactly what the backend has not published for this group. */
  missing: React.ReactNode;
  className?: string;
}

/**
 * A settings group whose backend contract does not exist yet.
 *
 * Renders the **real layout with real controls**, every one disabled, plus the
 * shared `BackendPendingNote` naming what is missing. It is a composition of
 * existing primitives — `Input`, `Switch`, `Select`, `Textarea`, `Card` and the
 * platform's Backend Pending components — not a new placeholder widget.
 *
 * The controls are deliberately real rather than grey rectangles: the point of
 * shipping these screens now is to agree the shape of the settings before the
 * API is written, and a skeleton communicates nothing about what a field is.
 * Every control is `disabled`, which removes it from the tab order, so a
 * keyboard user never lands on something that cannot be filled in.
 *
 * No form library, no schema, no submit handler. There is nothing to validate
 * against and nowhere to send it, and wiring `useZodForm` to a form that cannot
 * submit would imply a contract that does not exist.
 */
export function PendingSettingsGroup({
  title,
  description,
  fields,
  missing,
  className,
}: PendingSettingsGroupProps) {
  return (
    <Card className={className}>
      <CardHeader className="border-b">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 pt-4">
        {description ? (
          <p className="text-muted-foreground text-sm">{description}</p>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          {fields.map((field) => (
            <PendingControl key={field.label} field={field} />
          ))}
        </div>

        <div className="border-border flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <BackendPendingNote className="flex-1">{missing}</BackendPendingNote>
          <Button type="button" className="shrink-0" disabled>
            Save changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** One disabled control, with its label properly associated. */
function PendingControl({ field }: { field: PendingField }) {
  const id = `pending-${field.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const describedBy = field.description ? `${id}-description` : undefined;

  return (
    <div
      className={cn(
        "space-y-2",
        field.wide && "sm:col-span-2",
        field.kind === "switch" &&
          "border-border flex flex-row items-center justify-between gap-4 space-y-0 rounded-xl border p-4",
      )}
    >
      <div className={cn(field.kind === "switch" && "min-w-0 space-y-1")}>
        <Label htmlFor={id} className="text-muted-foreground">
          {field.label}
        </Label>
        {field.kind === "switch" && field.description ? (
          <p id={describedBy} className="text-muted-foreground text-sm">
            {field.description}
          </p>
        ) : null}
      </div>

      {field.kind === "switch" ? (
        <Switch id={id} disabled aria-describedby={describedBy} />
      ) : field.kind === "textarea" ? (
        <Textarea
          id={id}
          rows={3}
          disabled
          placeholder={field.placeholder}
          aria-describedby={describedBy}
        />
      ) : field.kind === "select" ? (
        <Select disabled>
          <SelectTrigger
            id={id}
            className="w-full"
            aria-describedby={describedBy}
          >
            <SelectValue
              placeholder={field.placeholder ?? "Not configurable yet"}
            />
          </SelectTrigger>
        </Select>
      ) : (
        <Input
          id={id}
          disabled
          placeholder={field.placeholder}
          aria-describedby={describedBy}
        />
      )}

      {field.kind !== "switch" && field.description ? (
        <p id={describedBy} className="text-muted-foreground text-xs">
          {field.description}
        </p>
      ) : null}
    </div>
  );
}
