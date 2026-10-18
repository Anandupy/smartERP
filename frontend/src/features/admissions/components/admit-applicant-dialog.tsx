"use client";

import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { GraduationCap, TriangleAlert } from "@/assets/icons";
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
import { Separator } from "@/components/ui/separator";
import { useWorkspace } from "@/core/workspace";
import { getErrorMessage } from "@/lib";
import { Spinner } from "@/shared/components/feedback";

import { useAdmitApplicant } from "../hooks/use-applicants";
import { useDirectAdmitApplicant } from "../hooks/use-workflow-policy";
import type {
  AdmitApplicantResponse,
  ApplicantDto,
} from "../types/applicant.dto";
import { ApplicantIdentitySummary } from "./applicant-identity-summary";
import { ApplicantStatusBadge } from "./applicant-status-badge";

const admitFormSchema = z.object({
  academicUnitId: z.string().min(1, "Required"),
});

export interface AdmitApplicantDialogProps {
  applicant: ApplicantDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The academic-unit picker (or its empty-state), slotted in by the route composition. */
  academicUnitPicker: React.ReactNode;
  /** Resolved by the route composition — Program is a separate feature. */
  programName: string | null;
  /** A short guardian summary, slotted in by the route composition (features/guardians). */
  guardianSummary: React.ReactNode;
  /** A short document-readiness summary, slotted in by the route composition (features/documents). */
  documentsSummary: React.ReactNode;
  /** `PersonPanel` from `features/person`, slotted in by the route composition. */
  renderPersonPanel: (personId: string, compact?: boolean) => React.ReactNode;
  /**
   * `academicUnitId` is the value this dialog's own form submitted — never
   * returned by `admit()` itself (the response is exactly six identifiers,
   * §8.6 — no placement id among them). Handed back alongside the response so
   * the caller can resolve it to a display path without a second read.
   */
  onAdmitted: (result: AdmitApplicantResponse, academicUnitId: string) => void;
  /**
   * `admit` (default): the final step of the standard process, from a
   * confirmed seat. `direct`: SIMPLE_ADMISSION's one-step admission — the
   * same review, but `POST .../direct-admit`, which also runs the remaining
   * submit, review, offer and seat-confirmation steps in the same backend
   * transaction.
   */
  mode?: "admit" | "direct";
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
 *
 * The review below exists so this reads as a real ERP transaction, not a
 * bare confirm — every section shows only what the confirmed contract
 * actually provides (`docs/admission-lifecycle-module.md`,
 * `backend/docs/planning/00-foundation/03-numbering.md`).
 */
export function AdmitApplicantDialog({
  applicant,
  open,
  onOpenChange,
  academicUnitPicker,
  programName,
  guardianSummary,
  documentsSummary,
  renderPersonPanel,
  onAdmitted,
  mode = "admit",
}: AdmitApplicantDialogProps) {
  const [submitError, setSubmitError] = useState<unknown>(null);
  const standardAdmit = useAdmitApplicant(applicant.id);
  const directAdmit = useDirectAdmitApplicant(applicant.id);
  const admit = mode === "direct" ? directAdmit : standardAdmit;
  const isDirect = mode === "direct";
  const actionLabel = isDirect ? "Admit student" : "Complete admission";
  const { branch, academicYear } = useWorkspace();

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
      onAdmitted(result, values.academicUnitId);
      onOpenChange(false);
      form.reset();
    } catch (error) {
      setSubmitError(error);
      toast.error(getErrorMessage(error));
    }
  });

  const isPending = admit.isPending;

  return (
    <Dialog open={open} onOpenChange={(next) => (isPending ? null : onOpenChange(next))}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap aria-hidden="true" />
            {isDirect ? "Admit" : "Complete admission for"}{" "}
            {applicant.displayName}?
          </DialogTitle>
          <DialogDescription>
            {isDirect
              ? "Review the details, choose the section and admit. Submission, review, the offer and seat confirmation are recorded automatically, then the Student, Admission and initial Enrollment are created — all in one backend transaction. Identity checks, required documents and numbering still apply; if any step fails, nothing is changed."
              : "This will permanently complete the admission transaction. A Student, Admission and initial Enrollment will be created, and the applicant will move to Admitted — all in one backend transaction. If any step fails, nothing is created."}
          </DialogDescription>
        </DialogHeader>

        {isPending ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Spinner
              size="lg"
              label={isDirect ? "Admitting student" : "Completing admission"}
            />
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {isDirect ? "Admitting student…" : "Completing admission…"}
              </p>
              <p className="text-muted-foreground text-xs">
                Creating the student, admission and enrollment records in one
                transaction. This will only take a moment.
              </p>
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <ReviewSection title="Applicant">
                <ReviewRow label="Name" value={applicant.displayName} />
                <ReviewRow
                  label="Application no."
                  value={applicant.applicationNo ?? "—"}
                />
                <ReviewRow
                  label="Current status"
                  value={<ApplicantStatusBadge status={applicant.admissionStatus} />}
                />
              </ReviewSection>

              <Separator />

              <ReviewSection title="Person">
                <ApplicantIdentitySummary
                  personId={applicant.personId}
                  renderPersonPanel={renderPersonPanel}
                  compact
                />
              </ReviewSection>

              <Separator />

              <ReviewSection title="Guardians">{guardianSummary}</ReviewSection>

              <Separator />

              <ReviewSection title="Academic placement">
                <ReviewRow label="Branch" value={branch?.name ?? "—"} />
                <ReviewRow label="Academic year" value={academicYear?.name ?? "—"} />
                <ReviewRow label="Program" value={programName ?? "—"} />
                <div className="pt-1">{academicUnitPicker}</div>
              </ReviewSection>

              <Separator />

              <ReviewSection title="Documents">{documentsSummary}</ReviewSection>

              {submitError ? (
                <div className="border-destructive/30 bg-destructive/5 rounded-lg border p-3">
                  <p className="text-destructive flex items-center gap-1.5 text-sm font-medium">
                    <TriangleAlert className="size-3.5" aria-hidden="true" />
                    Admission could not be completed
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {getErrorMessage(submitError)} Nothing was changed: no
                    Student, Admission or Enrollment was created
                    {isDirect ? ", and the application is as it was" : ""}.
                  </p>
                </div>
              ) : null}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {actionLabel}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReviewSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        {title}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-medium">{value}</span>
    </div>
  );
}
