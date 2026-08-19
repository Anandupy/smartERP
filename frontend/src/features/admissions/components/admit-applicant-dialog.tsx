"use client";

import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { GraduationCap } from "@/assets/icons";
import { Form, useZodForm } from "@/components/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getErrorMessage } from "@/lib";
import { Spinner } from "@/shared/components/feedback";

import { useAdmitApplicant } from "../hooks/use-applicants";
import type {
  AdmitApplicantResponse,
  ApplicantDto,
} from "../types/applicant.dto";

const admitFormSchema = z.object({
  academicUnitId: z.string().min(1, "Required"),
});

export interface AdmitApplicantDialogProps {
  applicant: ApplicantDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The academic-unit picker, slotted in by the route composition. */
  academicUnitPicker: React.ReactNode;
  onAdmitted: (result: AdmitApplicantResponse) => void;
}

/**
 * The final admission transaction — `POST .../admit`.
 *
 * Only rendered when `admissionStatus === "SEAT_CONFIRMED"` (the caller
 * gates this). The only input this transaction accepts is `academicUnitId`
 * — every other identifier (organization, branch, academic year, programme,
 * quota, admission source) comes from the applicant's own lineage and is
 * **not** collected here, because the backend does not accept it as input
 * (`docs/admission-lifecycle-module.md` §8.6). This is deliberately not a
 * "Save" button: the confirmation names exactly what will be created, and
 * failure never shows a partial success — the transaction is genuinely
 * atomic, verified by fault injection at every step.
 */
export function AdmitApplicantDialog({
  applicant,
  open,
  onOpenChange,
  academicUnitPicker,
  onAdmitted,
}: AdmitApplicantDialogProps) {
  const [submitError, setSubmitError] = useState<unknown>(null);
  const admit = useAdmitApplicant(applicant.id);

  const form = useZodForm(admitFormSchema, {
    defaultValues: { academicUnitId: "" },
    mode: "onSubmit",
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const result = await admit.mutateAsync({
        academicUnitId: values.academicUnitId,
      });
      onAdmitted(result);
      onOpenChange(false);
      form.reset();
    } catch (error) {
      setSubmitError(error);
      toast.error(getErrorMessage(error));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap aria-hidden="true" />
            Admit {applicant.displayName}?
          </DialogTitle>
          <DialogDescription>
            This is the final admission transaction. It creates the Student,
            the Admission and the first Enrollment, and moves the application
            to Admitted — all in one backend transaction. If any step fails,
            nothing is created.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {academicUnitPicker}

            {submitError ? (
              <p className="text-destructive text-sm">
                {getErrorMessage(submitError)}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={admit.isPending}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={admit.isPending}>
                {admit.isPending ? (
                  <Spinner size="sm" label="Admitting" />
                ) : null}
                {admit.isPending ? "Admitting…" : "Admit applicant"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
