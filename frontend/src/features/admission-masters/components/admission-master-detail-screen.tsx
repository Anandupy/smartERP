"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Info, Pencil, Power, Trash2 } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/constants";
import {
  DescriptionList,
  StatusBadge,
  type DescriptionItem,
} from "@/shared/components/data-display";
import { PageHeader } from "@/shared/components/layout";
import { formatDateTime } from "@/utils";

import {
  admissionMasterConfig,
  type AdmissionMasterConfig,
  type AdmissionMasterType,
} from "../config/admission-master-registry";
import { ADMISSION_MASTER_STATE_PRESENTATION, admissionMasterState } from "../constants";
import { useDeleteAdmissionMaster, useToggleAdmissionMasterActive } from "../hooks/use-admission-masters";
import type { AdmissionMasterDto } from "../types/admission-master.dto";
import { AdmissionMasterBoundary } from "./admission-master-boundary";
import {
  DeleteAdmissionMasterDialog,
  ToggleAdmissionMasterActiveDialog,
} from "./admission-master-dialogs";

export interface AdmissionMasterDetailScreenProps {
  masterType: AdmissionMasterType;
  id: string;
}

/** The record itself, once loaded. */
function Details({
  config,
  master,
  masterType,
}: {
  config: AdmissionMasterConfig;
  master: AdmissionMasterDto;
  masterType: AdmissionMasterType;
}) {
  const router = useRouter();
  const toggleActive = useToggleAdmissionMasterActive(masterType);
  const deleteMaster = useDeleteAdmissionMaster(masterType);
  const [pendingToggle, setPendingToggle] = useState<AdmissionMasterDto | null>(null);
  const [pendingDeletion, setPendingDeletion] = useState<AdmissionMasterDto | null>(null);

  const presentation = ADMISSION_MASTER_STATE_PRESENTATION[admissionMasterState(master)];
  const listHref = ROUTES.app.admissionMasters.list(config.resource);

  const overview: DescriptionItem[] = [
    { key: "name", label: "Name", value: master.name },
    {
      key: "code",
      label: "Code",
      value: <code className="bg-muted rounded px-1 py-0.5">{master.code}</code>,
    },
    { key: "description", label: "Description", value: master.description ?? "—", wide: true },
    { key: "displayOrder", label: "Display order", value: master.displayOrder },
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

  const meta: DescriptionItem[] = [
    { key: "id", label: `${config.singularLabel} id`, value: <code>{master.id}</code> },
    { key: "created", label: "Created", value: formatDateTime(master.createdAt) },
    { key: "updated", label: "Updated", value: formatDateTime(master.updatedAt) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={master.name}
        badge={
          <StatusBadge tone={presentation.tone} icon={presentation.icon}>
            {presentation.label}
          </StatusBadge>
        }
        description={config.singularLabel}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingToggle(master)}
            >
              <Power />
              {master.isActive ? "Deactivate" : "Activate"}
            </Button>
            <Button asChild variant="outline">
              <Link href={ROUTES.app.admissionMasters.edit(config.resource, master.id)}>
                <Pencil />
                Edit
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setPendingDeletion(master)}
            >
              <Trash2 />
              Delete
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Info aria-hidden="true" className="size-4" />
            Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <DescriptionList items={overview} columns={2} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Record metadata</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <DescriptionList items={meta} columns={2} />
        </CardContent>
      </Card>

      <ToggleAdmissionMasterActiveDialog
        master={pendingToggle}
        isPending={toggleActive.isPending}
        onOpenChange={(open) => {
          if (!open) setPendingToggle(null);
        }}
        onConfirm={async (target) => {
          await toggleActive.mutateAsync(target);
          setPendingToggle(null);
        }}
      />

      <DeleteAdmissionMasterDialog
        config={config}
        master={pendingDeletion}
        isPending={deleteMaster.isPending}
        onOpenChange={(open) => {
          if (!open) setPendingDeletion(null);
        }}
        onConfirm={async (target) => {
          await deleteMaster.mutateAsync(target.id);
          setPendingDeletion(null);
          router.push(listHref);
        }}
      />
    </div>
  );
}

/**
 * One admission master record, in full.
 *
 * Generic across all 10 resources — satisfies the documented
 * `GET /v1/admissions/masters/<resource>/:id` for every one of them,
 * including the originally requested "Relation Type Details" screen, without
 * building ten near-identical detail screens.
 */
export function AdmissionMasterDetailScreen({
  masterType,
  id,
}: AdmissionMasterDetailScreenProps) {
  const config = admissionMasterConfig(masterType);

  return (
    <AdmissionMasterBoundary masterType={masterType} config={config} id={id}>
      {(master) => (
        <Details config={config} master={master} masterType={masterType} />
      )}
    </AdmissionMasterBoundary>
  );
}
