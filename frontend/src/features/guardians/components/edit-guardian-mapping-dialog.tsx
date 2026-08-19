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

import { useMapGuardianToApplicant } from "../hooks/use-guardians";
import {
  toGuardianMappingFormValues,
  toMapGuardianRequest,
} from "../mappers/guardian.mapper";
import type { ApplicantGuardianMappingDto } from "../types/guardian.dto";
import { GuardianMappingForm } from "./guardian-mapping-form";

export interface EditGuardianMappingDialogProps {
  applicantId: string;
  mapping: ApplicantGuardianMappingDto | null;
  onOpenChange: (open: boolean) => void;
  relationTypePicker: React.ReactNode;
}

const FORM_ID = "edit-guardian-mapping-form";

/**
 * Edit a guardian's relationship to this application.
 *
 * There is no dedicated "update mapping" endpoint — mapping is documented
 * idempotent (module doc §5.4): calling `POST .../map` again for the same
 * guardian updates the existing link. This dialog is that same call with the
 * loaded flags as its starting point, not a different operation.
 */
export function EditGuardianMappingDialog({
  applicantId,
  mapping,
  onOpenChange,
  relationTypePicker,
}: EditGuardianMappingDialogProps) {
  const mapGuardian = useMapGuardianToApplicant(applicantId);

  return (
    <Dialog open={mapping !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit relationship</DialogTitle>
          <DialogDescription>
            Updates how this guardian relates to this application only.
          </DialogDescription>
        </DialogHeader>

        {mapping ? (
          <GuardianMappingForm
            formId={FORM_ID}
            defaultValues={toGuardianMappingFormValues(mapping)}
            disabled={mapGuardian.isPending}
            relationTypePicker={relationTypePicker}
            onSubmit={async (values) => {
              await mapGuardian.mutateAsync(
                toMapGuardianRequest(mapping.guardianId, values),
              );
              onOpenChange(false);
            }}
            onError={(message) => toast.error(message)}
          />
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={mapGuardian.isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={mapGuardian.isPending}>
            {mapGuardian.isPending ? (
              <Spinner size="sm" label="Saving" />
            ) : null}
            {mapGuardian.isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
