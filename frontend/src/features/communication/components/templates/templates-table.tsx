"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { Eye, Pencil } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants";
import { DataTable, DataTableColumnHeader } from "@/shared/components/data";
import { formatDateTime } from "@/utils";

import { ChannelBadge } from "../channel-badge";
import { TemplateStatusBadge } from "../template-status-badge";
import { categoryLabel } from "../../constants";
import { TEMPLATE_SCOPE_LABEL, templateScopeLevel } from "../../mappers/template.mapper";
import type { TemplateDto } from "../../types/template.dto";

export interface TemplatesTableProps {
  templates: TemplateDto[];
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyState?: React.ReactNode;
}

/**
 * The template directory table.
 *
 * Columns per `docs/communication-module-ui-spec.md` §12 (screen 2): name +
 * code, channel, category, language, version, scope, status, updated, and a
 * view/edit action. No delete or duplicate action — the spec's endpoint
 * inventory documents neither.
 */
export function TemplatesTable({
  templates,
  isLoading,
  error,
  onRetry,
  emptyState,
}: TemplatesTableProps) {
  const router = useRouter();

  const columns = useMemo<ColumnDef<TemplateDto, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Template" />
        ),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.original.name ?? "—"}</p>
            <p className="text-muted-foreground truncate text-xs">
              {row.original.code ?? "—"}
            </p>
          </div>
        ),
      },
      {
        id: "channel",
        enableSorting: false,
        header: () => (
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Channel
          </span>
        ),
        cell: ({ row }) => <ChannelBadge channel={row.original.channel} />,
      },
      {
        id: "category",
        enableSorting: false,
        header: () => (
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Category
          </span>
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {categoryLabel(row.original.category)}
          </span>
        ),
      },
      {
        id: "version",
        enableSorting: false,
        header: () => (
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Version
          </span>
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {row.original.language ?? "en"} · v{row.original.version ?? 1}
          </span>
        ),
      },
      {
        id: "scope",
        enableSorting: false,
        header: () => (
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Scope
          </span>
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {TEMPLATE_SCOPE_LABEL[templateScopeLevel(row.original)]}
          </span>
        ),
      },
      {
        id: "status",
        enableSorting: false,
        header: () => (
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Status
          </span>
        ),
        cell: ({ row }) => <TemplateStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "updatedAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Updated" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm whitespace-nowrap">
            {row.original.updatedAt ? formatDateTime(row.original.updatedAt) : "—"}
          </span>
        ),
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div
            className="flex justify-end gap-1"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`View ${row.original.name ?? "template"}`}
              onClick={() =>
                router.push(ROUTES.app.communication.templates.detail(row.original.id))
              }
            >
              <Eye />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Edit ${row.original.name ?? "template"}`}
              onClick={() =>
                router.push(ROUTES.app.communication.templates.edit(row.original.id))
              }
            >
              <Pencil />
            </Button>
          </div>
        ),
      },
    ],
    [router],
  );

  return (
    <DataTable
      caption="Message templates"
      columns={columns}
      data={templates}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyState={emptyState}
      getRowId={(template) => template.id}
      onRowClick={(template) =>
        router.push(ROUTES.app.communication.templates.detail(template.id))
      }
    />
  );
}
