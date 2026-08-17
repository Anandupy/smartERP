"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useCreateMenu, useUpdateMenu, eligibleParents } from "../../hooks/use-menus";
import { useModules } from "../../hooks/use-modules";
import { toMenuFormValues, toMenuRequest } from "../../mappers/menu.mapper";
import { menuFormDefaults } from "../../schemas/menu.schema";
import type { MenuDto, MenuListItemDto } from "../../types/menu.dto";
import { MenuForm } from "./menu-form";

export interface CreateMenuDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The module the tree is currently scoped to — seeds the form and narrows the parent picker. */
  moduleId: string;
  menusInModule: MenuListItemDto[];
  onCreated?: (menu: MenuDto) => void;
}

export function CreateMenuDialog({
  open,
  onOpenChange,
  moduleId,
  menusInModule,
  onCreated,
}: CreateMenuDialogProps) {
  const { modules } = useModules();
  const create = useCreateMenu();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create menu</DialogTitle>
          <DialogDescription>
            A new navigable destination inside this module.
          </DialogDescription>
        </DialogHeader>

        <MenuForm
          defaultValues={menuFormDefaults(moduleId)}
          submitLabel="Create menu"
          modules={modules}
          parentOptions={eligibleParents(menusInModule)}
          onCancel={() => onOpenChange(false)}
          onSubmit={async (values) => {
            const created = await create.mutateAsync(toMenuRequest(values));
            onOpenChange(false);
            onCreated?.(created);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

export interface EditMenuDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menu: MenuDto | null;
  menusInModule: MenuListItemDto[];
}

export function EditMenuDialog({
  open,
  onOpenChange,
  menu,
  menusInModule,
}: EditMenuDialogProps) {
  const { modules } = useModules();
  const update = useUpdateMenu(menu?.id ?? "");

  if (!menu) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit {menu.displayName}</DialogTitle>
          <DialogDescription>
            Changes take effect as soon as they are saved.
          </DialogDescription>
        </DialogHeader>

        <MenuForm
          defaultValues={toMenuFormValues(menu)}
          submitLabel="Save changes"
          modules={modules}
          parentOptions={eligibleParents(menusInModule, menu.id)}
          lockModule
          onCancel={() => onOpenChange(false)}
          onSubmit={async (values) => {
            await update.mutateAsync(toMenuRequest(values));
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
