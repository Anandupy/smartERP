"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Lock, Pencil, Power, Trash2 } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/constants";
import {
  DescriptionList,
  StatusBadge,
  type DescriptionItem,
} from "@/shared/components/data-display";
import { PageHeader } from "@/shared/components/layout";
import { formatBytes } from "@/utils";

import { ACTIVE_STATE_PRESENTATION, activeState } from "../constants";
import { useDeleteDocumentType, useToggleDocumentTypeActive } from "../hooks/use-documents";
import type { DocumentTypeDto } from "../types/document.dto";
import { DocumentTypeBoundary } from "./document-type-boundary";
import { DeleteDocumentTypeDialog, ToggleDocumentTypeActiveDialog } from "./document-type-dialogs";

function Details({ type }: { type: DocumentTypeDto }) {
  const router = useRouter();
  const toggleActive = useToggleDocumentTypeActive();
  const deleteType = useDeleteDocumentType();
  const [pendingToggle, setPendingToggle] = useState<DocumentTypeDto | null>(null);
  const [pendingDeletion, setPendingDeletion] = useState<DocumentTypeDto | null>(null);

  const presentation = ACTIVE_STATE_PRESENTATION[activeState(type)];
  const listHref = ROUTES.app.documents.types.root;

  const overview: DescriptionItem[] = [
    { key: "name", label: "Name", value: type.name },
    {
      key: "code",
      label: "Code",
      value: <code className="bg-muted rounded px-1 py-0.5">{type.code}</code>,
    },
    { key: "description", label: "Description", value: type.description ?? "—", wide: true },
    {
      key: "sensitive",
      label: "Sensitive",
      value: type.isSensitive ? (
        <span className="flex items-center gap-1.5">
          <Lock className="size-3.5" aria-hidden="true" /> Yes — download restricted to staff above the base role
        </span>
      ) : (
        "No"
      ),
    },
    {
      key: "status",
      label: "Status",
      value: (
        <StatusBadge tone={presentation.tone} icon={presentation.icon}>
          {presentation.label}
        </StatusBadge>
      ),
    },
  ];

  const lifecycle: DescriptionItem[] = [
    {
      key: "expiry",
      label: "Expiry",
      value: type.hasExpiry
        ? `Yes — ${type.defaultValidityMonths ?? "—"} month default validity`
        : "No expiry",
    },
    {
      key: "retention",
      label: "Retention",
      value: type.retentionYears ? `${type.retentionYears} years` : "Not set",
    },
  ];

  const fileRules: DescriptionItem[] = [
    {
      key: "mimeTypes",
      label: "Allowed file types",
      value: type.allowedMimeTypes.join(", ") || "—",
      wide: true,
    },
    { key: "maxSize", label: "Maximum size", value: formatBytes(type.maxSizeBytes) },
    {
      key: "displayOrder",
      label: "Display order",
      value:
        type.displayOrder !== undefined
          ? type.displayOrder
          : "Not returned by this endpoint",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={type.name}
        badge={
          <StatusBadge tone={presentation.tone} icon={presentation.icon}>
            {presentation.label}
          </StatusBadge>
        }
        description="Document type"
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => setPendingToggle(type)}>
              <Power />
              {type.isActive ? "Deactivate" : "Activate"}
            </Button>
            <Button asChild variant="outline">
              <Link href={ROUTES.app.documents.types.edit(type.id)}>
                <Pencil />
                Edit
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setPendingDeletion(type)}
            >
              <Trash2 />
              Delete
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <DescriptionList items={overview} columns={2} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Security &amp; lifecycle</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <DescriptionList items={lifecycle} columns={2} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>File rules</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <DescriptionList items={fileRules} columns={2} />
        </CardContent>
      </Card>

      <ToggleDocumentTypeActiveDialog
        type={pendingToggle}
        isPending={toggleActive.isPending}
        onOpenChange={(open) => {
          if (!open) setPendingToggle(null);
        }}
        onConfirm={async (target) => {
          await toggleActive.mutateAsync(target);
          setPendingToggle(null);
        }}
      />

      <DeleteDocumentTypeDialog
        type={pendingDeletion}
        isPending={deleteType.isPending}
        onOpenChange={(open) => {
          if (!open) setPendingDeletion(null);
        }}
        onConfirm={async (target) => {
          await deleteType.mutateAsync(target.id);
          setPendingDeletion(null);
          router.push(listHref);
        }}
      />
    </div>
  );
}

export interface DocumentTypeDetailScreenProps {
  id: string;
}

/** One document type, in full. */
export function DocumentTypeDetailScreen({ id }: DocumentTypeDetailScreenProps) {
  return (
    <DocumentTypeBoundary id={id}>
      {(type) => <Details type={type} />}
    </DocumentTypeBoundary>
  );
}
