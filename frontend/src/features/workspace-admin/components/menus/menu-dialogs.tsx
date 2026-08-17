"use client";

import { Copy, Trash2 } from "@/assets/icons";
import { ConfirmDialog } from "@/shared/components/overlay";

import type { MenuDto } from "../../types/menu.dto";

export interface DeleteMenuDialogProps {
  menu: MenuDto | null;
  hasChildren: boolean;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (menu: MenuDto) => void;
}

/**
 * Confirmation before deleting a menu. The backend blocks this (400) while
 * the menu still has children — the dialog explains the block rather than
 * offering an action that would only fail.
 */
export function DeleteMenuDialog({
  menu,
  hasChildren,
  isPending,
  onOpenChange,
  onConfirm,
}: DeleteMenuDialogProps) {
  return (
    <ConfirmDialog
      open={menu !== null}
      onOpenChange={onOpenChange}
      destructive
      icon={Trash2}
      title="Delete this menu?"
      description={
        !menu
          ? ""
          : hasChildren
            ? `“${menu.displayName}” has child menus and cannot be deleted until they are moved or removed first.`
            : `“${menu.displayName}” will be permanently deleted. This cannot be undone.`
      }
      confirmLabel="Delete menu"
      isPending={isPending}
      onConfirm={() => {
        if (menu && !hasChildren) onConfirm(menu);
      }}
    />
  );
}

export interface DuplicateMenuDialogProps {
  menu: MenuDto | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (menu: MenuDto) => void;
}

/**
 * Confirmation before duplicating a menu. States the two things the backend
 * documents about the copy: a suffixed code/route, and a forced `DISABLED`
 * status — so it never appears in a real navigation tree until reviewed.
 */
export function DuplicateMenuDialog({
  menu,
  isPending,
  onOpenChange,
  onConfirm,
}: DuplicateMenuDialogProps) {
  return (
    <ConfirmDialog
      open={menu !== null}
      onOpenChange={onOpenChange}
      icon={Copy}
      title="Duplicate this menu?"
      description={
        menu
          ? `A copy of “${menu.displayName}” will be created with a suffixed code and route, and status DISABLED until you review and activate it.`
          : ""
      }
      confirmLabel="Duplicate"
      isPending={isPending}
      onConfirm={() => {
        if (menu) onConfirm(menu);
      }}
    />
  );
}
