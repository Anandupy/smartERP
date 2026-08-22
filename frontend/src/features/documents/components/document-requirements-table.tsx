"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { EllipsisVertical, Pencil, Power, Trash2 } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROUTES } from "@/constants";
import { StatusBadge } from "@/shared/components/data-display";
import { DataTable, DataTableColumnHeader } from "@/shared/components/data";

import { ACTIVE_STATE_PRESENTATION, activeState } from "../constants";
import type { DocumentRequirementDto, DocumentTypeDto } from "../types/document.dto";

export interface DocumentRequirementsTableProps {
  requirements: DocumentRequirementDto[];
  documentTypesById: ReadonlyMap<string, DocumentTypeDto>;
  programNames: ReadonlyMap<string, string>;
  quotaNames: ReadonlyMap<string, string>;
  categoryNames: ReadonlyMap<string, string>;
  stageLabels: ReadonlyMap<string, string>;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyState?: React.ReactNode;
  onToggleActive: (requirement: DocumentRequirementDto) => void;
  onDelete: (requirement: DocumentRequirementDto) => void;
}

const ALL_LABEL = "All";

/** The directory table for Document Requirements. */
export function DocumentRequirementsTable({
  requirements,
  documentTypesById,
  programNames,
  quotaNames,
  categoryNames,
  stageLabels,
  isLoading,
  error,
  onRetry,
  emptyState,
  onToggleActive,
  onDelete,
}: DocumentRequirementsTableProps) {
  const router = useRouter();

  const columns = useMemo<ColumnDef<DocumentRequirementDto, unknown>[]>(
    () => [
      {
        id: "documentType",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Document" />,
        cell: ({ row }) => {
          const type = documentTypesById.get(row.original.documentTypeId);
          return (
            <div className="min-w-0">
              <p className="truncate font-medium">{type?.name ?? "—"}</p>
              {type?.code ? (
                <p className="text-muted-foreground truncate text-xs">
                  <code>{type.code}</code>
                </p>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "program",
        enableSorting: false,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Program" />,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {row.original.appliesToProgramId
              ? (programNames.get(row.original.appliesToProgramId) ?? "—")
              : `${ALL_LABEL} programs`}
          </span>
        ),
      },
      {
        id: "quota",
        enableSorting: false,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Quota" />,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {row.original.appliesToQuotaId
              ? (quotaNames.get(row.original.appliesToQuotaId) ?? "—")
              : ALL_LABEL}
          </span>
        ),
      },
      {
        id: "category",
        enableSorting: false,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Category" />,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {row.original.appliesToCategoryId
              ? (categoryNames.get(row.original.appliesToCategoryId) ?? "—")
              : ALL_LABEL}
          </span>
        ),
      },
      {
        id: "stage",
        enableSorting: false,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Required by" />,
        cell: ({ row }) => (
          <span className="text-sm">
            {stageLabels.get(row.original.requiredByStage) ?? row.original.requiredByStage}
          </span>
        ),
      },
      {
        id: "mandatory",
        enableSorting: false,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Requirement" />,
        cell: ({ row }) => (
          <StatusBadge tone={row.original.isMandatory ? "brand" : "neutral"}>
            {row.original.isMandatory ? "Required" : "Optional"}
          </StatusBadge>
        ),
      },
      {
        id: "status",
        enableSorting: false,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => {
          const presentation = ACTIVE_STATE_PRESENTATION[activeState(row.original)];
          return (
            <StatusBadge tone={presentation.tone} dot>
              {presentation.label}
            </StatusBadge>
          );
        },
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const requirement = row.original;
          return (
            <div
              className="flex justify-end"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Actions for ${documentTypesById.get(requirement.documentTypeId)?.name ?? "requirement"}`}
                  >
                    <EllipsisVertical />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() =>
                      router.push(ROUTES.app.documents.requirements.edit(requirement.id))
                    }
                  >
                    <Pencil aria-hidden="true" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onToggleActive(requirement)}>
                    <Power aria-hidden="true" />
                    {requirement.isActive ? "Deactivate" : "Activate"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => onDelete(requirement)}>
                    <Trash2 aria-hidden="true" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [categoryNames, documentTypesById, onDelete, onToggleActive, programNames, quotaNames, router, stageLabels],
  );

  return (
    <DataTable
      caption="Document Requirements"
      columns={columns}
      data={requirements}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyState={emptyState}
      getRowId={(requirement) => requirement.id}
      onRowClick={(requirement) =>
        router.push(ROUTES.app.documents.requirements.edit(requirement.id))
      }
    />
  );
}
