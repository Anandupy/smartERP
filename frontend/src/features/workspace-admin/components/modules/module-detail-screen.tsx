"use client";

import Link from "next/link";
import { useState } from "react";

import { Blocks, ListTree, Pencil, Power } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/constants";
import { usePermissions } from "@/core/auth";
import {
  DescriptionList,
  type DescriptionItem,
} from "@/shared/components/data-display";
import { BackendPendingNote, ForbiddenState } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";

import { ICON_NAME_OPTIONS, MENU_STATUS_PRESENTATION, UNKNOWN_ICON } from "../../constants";
import { useUpdateModuleStatus } from "../../hooks/use-modules";
import type { ModuleDetailDto } from "../../types/module.dto";
import { ModuleBoundary } from "./module-boundary";
import { ModuleStatusBadge } from "./module-status-badge";
import { ToggleModuleStatusDialog } from "./module-dialogs";

function Details({ module }: { module: ModuleDetailDto }) {
  const iconKey = module.icon?.trim().toLowerCase();
  const Icon = (iconKey ? ICON_NAME_OPTIONS[iconKey] : undefined) ?? UNKNOWN_ICON;
  const toggleStatus = useUpdateModuleStatus();
  const [confirmingToggle, setConfirmingToggle] = useState(false);

  const renderable = module.menus.filter(
    (menu) => MENU_STATUS_PRESENTATION[menu.status].renders,
  ).length;

  const identity: DescriptionItem[] = [
    { key: "name", label: "Name", value: module.name },
    {
      key: "code",
      label: "Code",
      value: <code className="bg-muted rounded px-1 py-0.5">{module.code}</code>,
    },
    { key: "description", label: "Description", value: module.description || "—", wide: true },
  ];

  const presentation: DescriptionItem[] = [
    {
      key: "icon",
      label: "Icon",
      value: (
        <span className="inline-flex items-center gap-2">
          <Icon className="size-4" aria-hidden="true" />
          {module.icon ?? "Not set"}
        </span>
      ),
    },
    { key: "order", label: "Display order", value: module.displayOrder },
  ];

  const navigation: DescriptionItem[] = [
    { key: "menuCount", label: "Menus in this module", value: module.menus.length },
    {
      key: "renderable",
      label: "In a renderable status",
      value: `${renderable} of ${module.menus.length}`,
    },
    {
      key: "note",
      label: "",
      value:
        "“Renderable” means status ACTIVE or BETA — the two statuses the navigation service ever returns to a user. It is not a claim about who can currently see them: that also depends on the module's active flag and each menu's own permissions.",
      wide: true,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={module.name}
        badge={<ModuleStatusBadge module={module} withIcon />}
        description={module.description || undefined}
        actions={
          <>
            <Button asChild variant="outline">
              <Link
                href={`${ROUTES.app.workspaceAdmin.menus.root}?module=${module.id}`}
              >
                <ListTree />
                View menus
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => setConfirmingToggle(true)}
            >
              <Power />
              {module.isActive ? "Deactivate" : "Activate"}
            </Button>
            <Button asChild>
              <Link href={ROUTES.app.workspaceAdmin.modules.edit(module.id)}>
                <Pencil />
                Edit
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <Blocks aria-hidden="true" className="size-4" />
              Identity
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <DescriptionList items={identity} columns={1} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Presentation</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <DescriptionList items={presentation} columns={2} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <ListTree aria-hidden="true" className="size-4" />
              Navigation
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <DescriptionList items={navigation} columns={1} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="border-b">
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <BackendPendingNote>
              feature flags and per-module configuration are not part of the
              module contract — `ModuleDto` has no such field. Presentation and
              access are controlled entirely by `icon`/`displayOrder` and the
              active flag above.
            </BackendPendingNote>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Metadata</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <DescriptionList
            columns={2}
            items={[
              { key: "id", label: "Module id", value: <code>{module.id}</code> },
              {
                key: "system",
                label: "Origin",
                value: module.isSystem ? "System module" : "Custom module",
              },
              { key: "created", label: "Created", value: module.createdAt },
              { key: "updated", label: "Last updated", value: module.updatedAt },
            ]}
          />
        </CardContent>
      </Card>

      <ToggleModuleStatusDialog
        module={
          confirmingToggle
            ? { ...module, _count: { menus: module.menus.length } }
            : null
        }
        isPending={toggleStatus.isPending}
        onOpenChange={setConfirmingToggle}
        onConfirm={async (target) => {
          await toggleStatus.mutateAsync({
            id: target.id,
            isActive: !target.isActive,
          });
          setConfirmingToggle(false);
        }}
      />
    </div>
  );
}

export interface ModuleDetailScreenProps {
  id: string;
}

/**
 * One module in full: identity, presentation, status, and how much navigation
 * it currently accounts for. Every field is one the module contract actually
 * returns — a "feature flags" panel the Stitch design might imply is replaced
 * by an explicit note, not a fabricated one.
 */
export function ModuleDetailScreen({ id }: ModuleDetailScreenProps) {
  const { hasRole } = usePermissions();

  if (!hasRole("SUPER_ADMIN")) {
    return (
      <ForbiddenState description="Navigation administration is Super Admin only." />
    );
  }

  return <ModuleBoundary id={id}>{(module) => <Details module={module} />}</ModuleBoundary>;
}
