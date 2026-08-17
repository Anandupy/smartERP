"use client";

import { useMemo } from "react";

import { cn } from "@/lib";
import { EmptyState } from "@/shared/components/feedback";
import { TreeView } from "@/shared/components/data";
import { buildTree } from "@/utils";

import type { MenuListItemDto } from "../../types/menu.dto";
import { MenuStatusBadge } from "./menu-status-badge";

export interface MenuTreeProps {
  /** Menus of exactly one module — a menu's parent is always within its own module. */
  menus: MenuListItemDto[];
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  selectedId?: string | null;
  onSelect: (menu: MenuListItemDto) => void;
}

/**
 * The menu hierarchy of one module, as a `TreeView`.
 *
 * Scoped to a single module rather than the whole registry: a menu's
 * `parentId` only ever names another menu in the same module in practice, and
 * rendering every module's menus in one tree would need a synthetic
 * module-level root the backend has no concept of.
 */
export function MenuTree({
  menus,
  isLoading,
  error,
  onRetry,
  selectedId,
  onSelect,
}: MenuTreeProps) {
  const { roots, orphans, cyclic } = useMemo(
    () =>
      buildTree(menus, {
        getId: (menu) => menu.id,
        getParentId: (menu) => menu.parentId,
        compare: (a, b) => a.displayOrder - b.displayOrder,
      }),
    [menus],
  );

  return (
    <div className="space-y-3">
      {orphans.length > 0 || cyclic.length > 0 ? (
        <p className="text-destructive text-xs" role="alert">
          {orphans.length > 0
            ? `${orphans.length} menu(s) reference a parent outside this module. `
            : ""}
          {cyclic.length > 0
            ? `${cyclic.length} menu(s) form a cycle and are not shown.`
            : ""}
        </p>
      ) : null}

      <TreeView
        roots={roots}
        caption="Menus in this module"
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        emptyState={
          <EmptyState
            title="No menus configured"
            description="Create the first menu for this module."
          />
        }
        renderNode={(menu) => {
          const isSelected = menu.id === selectedId;
          return (
            <button
              type="button"
              onClick={() => onSelect(menu)}
              aria-current={isSelected ? "true" : undefined}
              className={cn(
                "flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                isSelected
                  ? "bg-primary/10 text-foreground"
                  : "hover:bg-muted text-foreground/90",
              )}
            >
              <span className="min-w-0 flex-1 truncate">{menu.displayName}</span>
              <MenuStatusBadge status={menu.status} className="shrink-0" />
            </button>
          );
        }}
      />
    </div>
  );
}
