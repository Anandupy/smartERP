"use client";

import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/shared/components/feedback";

import { eligibleParents, useMenus } from "../../hooks/use-menus";
import { useModules } from "../../hooks/use-modules";
import { NO_PARENT } from "../../schemas/menu.schema";
import type { MenuDto } from "../../types/menu.dto";

export interface MenuMoveDialogProps {
  menu: MenuDto | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: {
    targetModuleId: string;
    targetParentId: string | null;
  }) => void;
}

/**
 * Change a menu's parent and/or module.
 *
 * `eligibleParents` narrows the parent picker using the target module's own
 * menus, so the common mistakes — cycles, exceeding the 3-level depth limit —
 * are unrepresentable from this dialog. The server (`MenuHierarchyValidator`)
 * is still the real check; this only avoids offering a choice it would reject.
 */
export function MenuMoveDialog({
  menu,
  isPending,
  onOpenChange,
  onConfirm,
}: MenuMoveDialogProps) {
  const { modules } = useModules();
  const [targetModuleId, setTargetModuleId] = useState(menu?.moduleId ?? "");
  const [targetParentId, setTargetParentId] = useState(NO_PARENT);
  const { menus: targetMenus } = useMenus(targetModuleId || undefined);

  const parents = menu
    ? eligibleParents(targetMenus, targetModuleId === menu.moduleId ? menu.id : undefined)
    : [];

  if (!menu) return null;

  return (
    <Dialog
      open={menu !== null}
      onOpenChange={(open) => {
        if (open) {
          setTargetModuleId(menu.moduleId);
          setTargetParentId(menu.parentId ?? NO_PARENT);
        }
        onOpenChange(open);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move “{menu.displayName}”</DialogTitle>
          <DialogDescription>
            The server rejects a move that would create a cycle or exceed the
            3-level depth limit; only options this dialog believes are valid
            are offered.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="move-target-module">Target module</Label>
            <Select
              value={targetModuleId}
              onValueChange={(value) => {
                setTargetModuleId(value);
                setTargetParentId(NO_PARENT);
              }}
            >
              <SelectTrigger id="move-target-module" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {modules.map((module) => (
                  <SelectItem key={module.id} value={module.id}>
                    {module.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="move-target-parent">Target parent</Label>
            <Select value={targetParentId} onValueChange={setTargetParentId}>
              <SelectTrigger id="move-target-parent" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PARENT}>None — top level</SelectItem>
                {parents.map((parent) => (
                  <SelectItem key={parent.id} value={parent.id}>
                    {parent.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isPending}
            onClick={() =>
              onConfirm({
                targetModuleId,
                targetParentId: targetParentId === NO_PARENT ? null : targetParentId,
              })
            }
          >
            {isPending ? <Spinner size="sm" /> : null}
            Move menu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
