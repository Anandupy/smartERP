"use client";

import Link from "next/link";
import { useState } from "react";

import { Eye, Pencil } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/constants";
import {
  DescriptionList,
  type DescriptionItem,
} from "@/shared/components/data-display";
import { ApiErrorState, FormSkeleton } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";
import { formatDateTime } from "@/utils";

import { categoryLabel, channelLabel } from "../../constants";
import { useTemplate } from "../../hooks/use-templates";
import {
  TEMPLATE_SCOPE_LABEL,
  templateScopeLevel,
  toVariablesText,
} from "../../mappers/template.mapper";
import { ChannelBadge } from "../channel-badge";
import { TemplateStatusBadge } from "../template-status-badge";
import { TemplatePreviewDrawer } from "./template-preview-drawer";

export interface TemplateDetailsScreenProps {
  id: string;
}

/**
 * Template Details — `GET /communication/templates/:id`.
 *
 * The raw stored content is shown as-is; the live-rendered form (against real
 * sample variables) is the Preview drawer, which calls the same
 * `POST /templates/preview` endpoint the directory and editor use — this
 * screen never re-implements rendering.
 */
export function TemplateDetailsScreen({ id }: TemplateDetailsScreenProps) {
  const { data: template, isPending, error, refetch } = useTemplate(id);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  if (isPending) {
    return (
      <div className="space-y-6">
        <PageHeader title="Template" />
        <FormSkeleton fields={6} />
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="space-y-6">
        <PageHeader title="Template" />
        <ApiErrorState error={error} onRetry={() => refetch()} />
      </div>
    );
  }

  const items: DescriptionItem[] = [
    { key: "code", label: "Code", value: template.code ?? "—" },
    {
      key: "channel",
      label: "Channel",
      value: <ChannelBadge channel={template.channel} />,
    },
    { key: "category", label: "Category", value: categoryLabel(template.category) },
    {
      key: "status",
      label: "Status",
      value: <TemplateStatusBadge status={template.status} />,
    },
    { key: "language", label: "Language", value: template.language ?? "en" },
    { key: "version", label: "Version", value: String(template.version ?? 1) },
    {
      key: "scope",
      label: "Scope",
      value: TEMPLATE_SCOPE_LABEL[templateScopeLevel(template)],
    },
    {
      key: "variables",
      label: "Variables",
      value: toVariablesText(template.variables) || "None declared",
      wide: true,
    },
    {
      key: "updated",
      label: "Last updated",
      value: template.updatedAt ? formatDateTime(template.updatedAt) : "—",
    },
    {
      key: "description",
      label: "Description",
      value: template.description ?? "—",
      wide: true,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={template.name ?? "Template"}
        badge={<TemplateStatusBadge status={template.status} />}
        description={`${channelLabel(template.channel)} · ${template.code ?? ""}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={ROUTES.app.communication.templates.root}>
                Back to directory
              </Link>
            </Button>
            <Button type="button" variant="outline" onClick={() => setIsPreviewOpen(true)}>
              <Eye />
              Preview
            </Button>
            <Button asChild>
              <Link href={ROUTES.app.communication.templates.edit(id)}>
                <Pencil />
                Edit
              </Link>
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <DescriptionList items={items} columns={2} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Stored content</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {template.subject ? (
            <div>
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Subject
              </p>
              <p className="text-sm">{template.subject}</p>
            </div>
          ) : null}
          {template.bodyHtml ? (
            <div>
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                HTML body
              </p>
              <pre className="bg-muted overflow-x-auto rounded-lg p-3 text-xs whitespace-pre-wrap">
                {template.bodyHtml}
              </pre>
            </div>
          ) : null}
          {template.bodyText ? (
            <div>
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Text body
              </p>
              <pre className="bg-muted overflow-x-auto rounded-lg p-3 text-xs whitespace-pre-wrap">
                {template.bodyText}
              </pre>
            </div>
          ) : null}
          {!template.subject && !template.bodyHtml && !template.bodyText ? (
            <p className="text-muted-foreground text-sm">No content stored yet.</p>
          ) : null}
        </CardContent>
      </Card>

      <TemplatePreviewDrawer
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        template={template}
      />
    </div>
  );
}
