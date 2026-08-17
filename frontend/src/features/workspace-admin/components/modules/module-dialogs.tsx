"use client";

import { Power, Trash2 } from "@/assets/icons";
import { ConfirmDialog } from "@/shared/components/overlay";

import type { ModuleListItemDto } from "../../types/module.dto";

export interface ToggleModuleStatusDialogProps {
  module: ModuleListItemDto | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (module: ModuleListItemDto) => void;
}

/**
 * Confirmation before flipping a module's active flag.
 *
 * Names the affected menu count before acting — deactivating hides every menu
 * beneath it, for every user, immediately (`workspace.prisma`'s cascade
 * behaviour, confirmed against `module-admin.service.ts`), and that blast
 * radius is exactly the kind of consequence a confirmation exists to surface.
 */
export function ToggleModuleStatusDialog({
  module,
  isPending,
  onOpenChange,
  onConfirm,
}: ToggleModuleStatusDialogProps) {
  const willDeactivate = module?.isActive ?? false;
  const menuCount = module?._count.menus ?? 0;

  return (
    <ConfirmDialog
      open={module !== null}
      onOpenChange={onOpenChange}
      icon={Power}
      destructive={willDeactivate}
      title={module ? `${willDeactivate ? "Deactivate" : "Activate"} “${module.name}”?` : ""}
      description={
        module
          ? willDeactivate
            ? `This hides ${menuCount === 1 ? "1 menu" : `all ${menuCount} menus`} in this module from every user's navigation, immediately. It can be reactivated at any time.`
            : `This makes ${menuCount === 1 ? "1 menu" : `all ${menuCount} menus`} in this module eligible to appear in navigation again, subject to each user's permissions.`
          : ""
      }
      confirmLabel={willDeactivate ? "Deactivate module" : "Activate module"}
      isPending={isPending}
      onConfirm={() => {
        if (module) onConfirm(module);
      }}
    />
  );
}

export interface DeleteModuleDialogProps {
  module: ModuleListItemDto | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (module: ModuleListItemDto) => void;
}

/**
 * Confirmation before deleting a module.
 *
 * The backend blocks deletion (400) while any menu still belongs to the
 * module or while it is system-owned — `ModulesTable` already disables the
 * action in both cases, so reaching this dialog means the delete is genuinely
 * permitted, and it is a hard delete, not a soft one (no `isDeleted` field
 * exists on `ModuleDto`).
 */
export function DeleteModuleDialog({
  module,
  isPending,
  onOpenChange,
  onConfirm,
}: DeleteModuleDialogProps) {
  return (
    <ConfirmDialog
      open={module !== null}
      onOpenChange={onOpenChange}
      destructive
      icon={Trash2}
      title="Delete this module?"
      description={
        module
          ? `“${module.name}” will be permanently deleted. This cannot be undone.`
          : ""
      }
      confirmLabel="Delete module"
      isPending={isPending}
      onConfirm={() => {
        if (module) onConfirm(module);
      }}
    />
  );
}
