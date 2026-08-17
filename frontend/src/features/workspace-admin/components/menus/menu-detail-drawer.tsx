"use client";

import { Copy, ListTree, Move, Pencil, Trash2 } from "@/assets/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DescriptionList,
  type DescriptionItem,
} from "@/shared/components/data-display";
import { ApiErrorState } from "@/shared/components/feedback";
import { DetailDrawer } from "@/shared/components/overlay";
import { ancestorPath } from "@/utils";

import { useMenu } from "../../hooks/use-menus";
import type { MenuListItemDto } from "../../types/menu.dto";
import { MenuStatusBadge } from "./menu-status-badge";
import { MenuVisibilityIndicator } from "./menu-visibility-indicator";

export interface MenuDetailDrawerProps {
  menuId: string | null;
  menusInModule: MenuListItemDto[];
  moduleActive: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onMove: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

/**
 * One menu in full, in a side panel — S9. Ancestry is computed from the
 * module's already-loaded menu list via `ancestorPath` rather than trusting
 * `menu.parent` alone, so it reads correctly even several levels deep.
 */
export function MenuDetailDrawer({
  menuId,
  menusInModule,
  moduleActive,
  onOpenChange,
  onEdit,
  onMove,
  onDuplicate,
  onDelete,
}: MenuDetailDrawerProps) {
  const query = useMenu(menuId ?? "");

  const ancestry = menuId
    ? ancestorPath(menusInModule, {
        getId: (menu) => menu.id,
        getParentId: (menu) => menu.parentId,
      }, menuId)
    : [];

  return (
    <DetailDrawer
      open={menuId !== null}
      onOpenChange={onOpenChange}
      size="wide"
      title={query.data?.displayName ?? "Menu"}
      description={query.data?.route}
      toolbar={
        query.data ? (
          <div className="flex flex-wrap items-center gap-2">
            <MenuStatusBadge status={query.data.status} withIcon />
            <MenuVisibilityIndicator
              menu={query.data}
              moduleActive={moduleActive}
            />
          </div>
        ) : null
      }
      footer={
        query.data ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil /> Edit
            </Button>
            <Button variant="outline" size="sm" onClick={onMove}>
              <Move /> Move
            </Button>
            <Button variant="outline" size="sm" onClick={onDuplicate}>
              <Copy /> Duplicate
            </Button>
            <Button variant="outline" size="sm" onClick={onDelete}>
              <Trash2 /> Delete
            </Button>
          </div>
        ) : null
      }
    >
      {query.isPending ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : query.error ? (
        <ApiErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data ? (
        (() => {
          const menu = query.data;
          const identity: DescriptionItem[] = [
            { key: "id", label: "Id", value: <code>{menu.id}</code> },
            { key: "code", label: "Code", value: <code>{menu.code}</code> },
            { key: "route", label: "Route", value: <code>{menu.route}</code> },
            {
              key: "component",
              label: "Component identifier",
              value: menu.componentIdentifier || "—",
            },
            { key: "description", label: "Description", value: menu.description || "—", wide: true },
          ];

          return (
            <div className="space-y-6">
              {ancestry.length > 1 ? (
                <div className="flex items-center gap-1 text-sm">
                  <ListTree
                    aria-hidden="true"
                    className="text-muted-foreground size-4 shrink-0"
                  />
                  <ol className="text-muted-foreground flex flex-wrap items-center gap-1">
                    {ancestry.map((ancestor, index) => (
                      <li key={ancestor.id} className="flex items-center gap-1">
                        {index > 0 ? <span aria-hidden="true">/</span> : null}
                        <span
                          className={
                            ancestor.id === menu.id ? "text-foreground font-medium" : ""
                          }
                        >
                          {ancestor.displayName}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}

              <DescriptionList items={identity} columns={1} />

              <div className="space-y-2">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Permissions
                </p>
                {menu.permissions.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {menu.permissions.map((permission) => (
                      <Badge key={permission} variant="outline">
                        {permission}
                      </Badge>
                    ))}
                    <Badge>{menu.permissionMode}</Badge>
                  </div>
                ) : (
                  <p className="text-sm">None — every authenticated user.</p>
                )}
              </div>

              <p className="text-muted-foreground text-sm">
                Hiding a menu here does not revoke access to its route — the
                route still exists. Enforcing access is the job of the
                permissions above, evaluated server-side.
              </p>

              <DescriptionList
                columns={2}
                items={[
                  { key: "children", label: "Children", value: menu.children.length },
                  {
                    key: "keywords",
                    label: "Search keywords",
                    value: menu.searchKeywords.length > 0 ? menu.searchKeywords.join(", ") : "—",
                    wide: true,
                  },
                  { key: "created", label: "Created", value: menu.createdAt },
                  { key: "updated", label: "Last updated", value: menu.updatedAt },
                ]}
              />
            </div>
          );
        })()
      ) : null}
    </DetailDrawer>
  );
}
