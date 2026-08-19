"use client";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/shared/components/feedback";

import { useUpdateGuardian } from "../hooks/use-guardians";
import { toGuardianFormValues, toGuardianRequest } from "../mappers/guardian.mapper";
import type { GuardianDto } from "../types/guardian.dto";
import { GuardianForm } from "./guardian-form";

export interface EditGuardianDialogProps {
  guardian: GuardianDto | null;
  onOpenChange: (open: boolean) => void;
}

const FORM_ID = "edit-guardian-form";

/**
 * Edit a guardian's own details — a standalone record, independent of any
 * one application. Editing here can affect every application this guardian
 * is mapped to.
 */
export function EditGuardianDialog({
  guardian,
  onOpenChange,
}: EditGuardianDialogProps) {
  const update = useUpdateGuardian(guardian?.id ?? "");

  return (
    <Dialog open={guardian !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit guardian</DialogTitle>
          <DialogDescription>
            Changes apply to this guardian&apos;s record everywhere they are
            mapped, not just this application.
          </DialogDescription>
        </DialogHeader>

        {guardian ? (
          <GuardianForm
            formId={FORM_ID}
            defaultValues={toGuardianFormValues(guardian)}
            disabled={update.isPending}
            onSubmit={async (values) => {
              await update.mutateAsync(toGuardianRequest(values));
              onOpenChange(false);
            }}
            onError={(message) => toast.error(message)}
          />
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={update.isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={update.isPending}>
            {update.isPending ? <Spinner size="sm" label="Saving" /> : null}
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
