"use client";

import { useState } from "react";
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

import {
  useCreateGuardian,
  useMapGuardianToApplicant,
} from "../hooks/use-guardians";
import { toGuardianRequest, toMapGuardianRequest } from "../mappers/guardian.mapper";
import {
  guardianFormDefaults,
  guardianMappingFormDefaults,
} from "../schemas/guardian.schema";
import type { GuardianDto } from "../types/guardian.dto";
import { GuardianForm } from "./guardian-form";
import { GuardianMappingForm } from "./guardian-mapping-form";
import { GuardianSearchPanel } from "./guardian-search-panel";

type Step = "search" | "create" | "mapping";

export interface AddGuardianDialogProps {
  applicantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The Relation Type master picker, slotted in by the route composition. */
  relationTypePicker: React.ReactNode;
}

const GUARDIAN_FORM_ID = "add-guardian-form";
const MAPPING_FORM_ID = "add-guardian-mapping-form";

/**
 * Add a guardian to this application — the three-step flow the current
 * contract actually supports (module doc §5.7): find-or-create the guardian,
 * then map it. There is no single nested-payload endpoint, so this dialog
 * does not pretend one exists.
 */
export function AddGuardianDialog({
  applicantId,
  open,
  onOpenChange,
  relationTypePicker,
}: AddGuardianDialogProps) {
  const [step, setStep] = useState<Step>("search");
  const [selected, setSelected] = useState<GuardianDto | null>(null);

  const createGuardian = useCreateGuardian();
  const mapGuardian = useMapGuardianToApplicant(applicantId);

  const reset = () => {
    setStep("search");
    setSelected(null);
  };

  const close = () => {
    onOpenChange(false);
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
        else onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === "search"
              ? "Add guardian"
              : step === "create"
                ? "New guardian"
                : `Map ${selected?.firstName ?? "guardian"} to this application`}
          </DialogTitle>
          <DialogDescription>
            {step === "search"
              ? "Find an existing guardian — useful for a sibling who already has one on record — or create a new one."
              : step === "create"
                ? "The guardian's own details. This creates a standalone guardian record, independent of this application."
                : "The relationship this guardian has to the application."}
          </DialogDescription>
        </DialogHeader>

        {step === "search" ? (
          <div className="space-y-4">
            <GuardianSearchPanel
              onSelect={(guardian) => {
                setSelected(guardian);
                setStep("mapping");
              }}
            />
            <div className="border-border border-t pt-4">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setStep("create")}
              >
                Create new guardian instead
              </Button>
            </div>
          </div>
        ) : null}

        {step === "create" ? (
          <GuardianForm
            formId={GUARDIAN_FORM_ID}
            defaultValues={guardianFormDefaults()}
            disabled={createGuardian.isPending}
            onSubmit={async (values) => {
              const guardian = await createGuardian.mutateAsync(
                toGuardianRequest(values),
              );
              setSelected(guardian);
              setStep("mapping");
            }}
            onError={(message) => toast.error(message)}
          />
        ) : null}

        {step === "mapping" && selected ? (
          <GuardianMappingForm
            formId={MAPPING_FORM_ID}
            defaultValues={guardianMappingFormDefaults()}
            disabled={mapGuardian.isPending}
            relationTypePicker={relationTypePicker}
            onSubmit={async (values) => {
              await mapGuardian.mutateAsync(
                toMapGuardianRequest(selected.id, values),
              );
              close();
            }}
            onError={(message) => toast.error(message)}
          />
        ) : null}

        <DialogFooter>
          {step !== "search" ? (
            <Button
              type="button"
              variant="outline"
              disabled={createGuardian.isPending || mapGuardian.isPending}
              onClick={() => {
                if (step === "mapping" && !selected) return;
                setStep("search");
                setSelected(null);
              }}
            >
              Back
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
          )}

          {step === "create" ? (
            <Button
              type="submit"
              form={GUARDIAN_FORM_ID}
              disabled={createGuardian.isPending}
            >
              {createGuardian.isPending ? (
                <Spinner size="sm" label="Creating" />
              ) : null}
              {createGuardian.isPending ? "Creating…" : "Continue"}
            </Button>
          ) : null}

          {step === "mapping" ? (
            <Button
              type="submit"
              form={MAPPING_FORM_ID}
              disabled={mapGuardian.isPending}
            >
              {mapGuardian.isPending ? (
                <Spinner size="sm" label="Mapping" />
              ) : null}
              {mapGuardian.isPending ? "Mapping…" : "Add guardian"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
