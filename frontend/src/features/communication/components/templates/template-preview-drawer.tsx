"use client";

import { useState } from "react";

import { Eye } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiErrorState, Banner, Spinner } from "@/shared/components/feedback";
import { DetailDrawer } from "@/shared/components/overlay";

import { useTemplatePreview } from "../../hooks/use-templates";
import type { CommunicationChannel, TemplateDto } from "../../types/template.dto";
import { ChannelBadge } from "../channel-badge";

export interface TemplatePreviewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The template to preview. Identified to the backend by its id. */
  template: Pick<TemplateDto, "id" | "name" | "channel" | "variables"> | null;
}

/** The variable names a preview form should collect. */
function variableNames(variables: TemplateDto["variables"]): string[] {
  if (Array.isArray(variables)) return variables;
  if (variables && typeof variables === "object") return Object.keys(variables);
  return [];
}

/**
 * Template Preview Drawer — `POST /communication/templates/preview?channel=`.
 *
 * Identifies the template by `templateId` (never `code`, since a row from the
 * directory always has one). Collects a sample value per documented variable
 * name and calls the real backend renderer — this module never fakes
 * rendering locally. `missingVariables` in the response is surfaced as a
 * warning banner rather than silently dropped.
 */
export function TemplatePreviewDrawer({
  open,
  onOpenChange,
  template,
}: TemplatePreviewDrawerProps) {
  const preview = useTemplatePreview();
  const [values, setValues] = useState<Record<string, string>>({});
  // Tracks which template the form fields were last seeded for, so opening
  // the drawer against a different (or newly reopened) template resets the
  // sample values — adjusted during render rather than in an effect, per
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes.
  const [seededFor, setSeededFor] = useState<string | null>(null);

  const names = template ? variableNames(template.variables) : [];
  const seedKey = open && template ? template.id : null;

  if (seedKey !== null && seedKey !== seededFor) {
    setSeededFor(seedKey);
    setValues(Object.fromEntries(names.map((name) => [name, ""])));
    preview.reset();
  }

  if (!template) return null;

  const handlePreview = () => {
    preview.mutate({
      body: {
        templateId: template.id,
        variables: values,
      },
      channel: (template.channel ?? "EMAIL") as CommunicationChannel,
    });
  };

  const result = preview.data;

  return (
    <DetailDrawer
      open={open}
      onOpenChange={onOpenChange}
      size="wide"
      title={template.name ?? "Template preview"}
      description={<ChannelBadge channel={template.channel} />}
      footer={
        <Button type="button" onClick={handlePreview} disabled={preview.isPending}>
          {preview.isPending ? <Spinner size="sm" /> : <Eye />}
          Render preview
        </Button>
      }
    >
      <div className="space-y-6">
        {names.length > 0 ? (
          <section className="space-y-3">
            <h3 className="text-sm font-medium">Sample variables</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {names.map((name) => (
                <div key={name} className="space-y-1.5">
                  <Label htmlFor={`preview-var-${name}`}>{name}</Label>
                  <Input
                    id={`preview-var-${name}`}
                    value={values[name] ?? ""}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [name]: event.target.value,
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </section>
        ) : (
          <p className="text-muted-foreground text-sm">
            This template documents no variable names to fill in.
          </p>
        )}

        {preview.isError ? (
          <ApiErrorState
            error={preview.error}
            title="Couldn't render preview"
            onRetry={handlePreview}
          />
        ) : null}

        {result ? (
          <section className="space-y-3">
            <h3 className="text-sm font-medium">Rendered output</h3>

            {result.missingVariables && result.missingVariables.length > 0 ? (
              <Banner
                tone="warning"
                title="Missing variables"
                description={`Not supplied: ${result.missingVariables.join(", ")}`}
              />
            ) : null}

            <div className="border-border space-y-3 rounded-xl border p-4">
              {result.subject ? (
                <div>
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Subject
                  </p>
                  <p className="text-sm font-medium">{result.subject}</p>
                </div>
              ) : null}
              {result.bodyHtml ? (
                <div>
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    HTML body
                  </p>
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none rounded-lg border p-3"
                    // Server-rendered HTML from the same backend that owns the
                    // template's write permissions (SUPER_ADMIN/ORG_ADMIN) — the
                    // trust boundary is template authorship, not this drawer.
                    dangerouslySetInnerHTML={{ __html: result.bodyHtml }}
                  />
                </div>
              ) : null}
              {result.bodyText ? (
                <div>
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    {template.channel === "EMAIL" ? "Text body" : "Body"}
                  </p>
                  <Textarea
                    readOnly
                    value={result.bodyText}
                    rows={6}
                    className="resize-none"
                  />
                </div>
              ) : null}
              {!result.subject && !result.bodyHtml && !result.bodyText ? (
                <p className="text-muted-foreground text-sm">
                  The server returned no renderable content for this channel.
                </p>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </DetailDrawer>
  );
}
