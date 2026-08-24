"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { InitializeSettingsForm } from "./initialize-settings-form";

export interface InitializeSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * First-time initialization of the global configuration.
 *
 * Deliberately a dialog on the empty state rather than a screen of its own: it
 * runs once in the lifetime of an installation, and a permanent route to an
 * endpoint that will refuse every call after the first is a route that only
 * ever produces errors. The form itself is `InitializeSettingsForm`, shared
 * with the setup wizard's System Settings step
 * (`docs/workspace-setup-module.md`) so the two never drift apart.
 */
export function InitializeSettingsDialog({
  open,
  onOpenChange,
}: InitializeSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Initialize system settings</DialogTitle>
          <DialogDescription>
            This establishes the installation&apos;s global configuration and
            can only be done once.
          </DialogDescription>
        </DialogHeader>

        <InitializeSettingsForm
          onCancel={() => onOpenChange(false)}
          onSubmitted={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
