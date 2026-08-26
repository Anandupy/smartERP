"use client";

import { useState } from "react";

import { CalendarRange, TriangleAlert } from "@/assets/icons";
import {
  Form,
  TextField,
  applyServerFieldErrors,
  useZodForm,
} from "@/components/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErrorMessage } from "@/lib";
import { BackendPendingNote, Banner, Spinner } from "@/shared/components/feedback";
import { formatDate } from "@/utils";

import {
  academicYearFormSchema,
  findOverlappingYear,
  type AcademicYearFormValues,
} from "../schemas/academic-year.schema";
import type { AcademicYearDto } from "../types/academic-year.dto";
import { academicYearProgress } from "../utils/academic-year-timeline";

export interface AcademicYearFormProps {
  defaultValues: AcademicYearFormValues;
  submitLabel: string;
  onSubmit: (values: AcademicYearFormValues) => Promise<unknown>;
  onCancel: () => void;
  /** The branch this year belongs to, for the locked caption. */
  branchName?: string;
  /**
   * The branch's existing years, for the client-side overlap check (documented
   * validation rule 2). Omit where the list is not loaded — the server remains
   * the authority either way.
   */
  existingYears?: readonly AcademicYearDto[];
  /** The record being edited, so it does not overlap itself. */
  editingId?: string;
  /** `data-guide` id for the submit button, for the Academic Years guide.
   * Omitted on Edit — only Create is part of that walkthrough. */
  submitGuideTarget?: string;
}

/**
 * Create or edit an academic year.
 *
 * One form for both, because create and update take identical bodies — the only
 * difference is which mutation the route hands in.
 *
 * The fields are exactly the four the Postman request defines. The design also
 * shows a term/semester builder, a holiday calendar and an "academic cycle"
 * selector; none of those is in the contract, so none of them is here.
 *
 * **`branchId` is not a control.** It is a documented required field, but it
 * comes from the active workspace rather than a picker, and it is fixed when
 * editing: the documentation scopes overlap validation and single-selection per
 * branch, and says nothing about what should happen to the attendance, marks,
 * fees and admissions records that the architecture section describes as linked
 * to an `academicYearId`. Moving a year between branches is a migration, not an
 * edit, so the form does not offer it.
 *
 * The date fields are native `date` inputs. That is a deliberate choice over a
 * calendar popover: the documented wire format is exactly the `YYYY-MM-DD` a
 * native date input produces, so there is no parsing step to get wrong, and the
 * native control is already keyboard-accessible and localised by the platform.
 */
export function AcademicYearForm({
  defaultValues,
  submitLabel,
  onSubmit,
  onCancel,
  branchName,
  existingYears,
  editingId,
  submitGuideTarget,
}: AcademicYearFormProps) {
  const [submitError, setSubmitError] = useState<unknown>(null);

  const form = useZodForm(academicYearFormSchema, {
    defaultValues,
    mode: "onSubmit",
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await onSubmit(values);
    } catch (error) {
      const boundToFields = applyServerFieldErrors(error, form.setError);
      if (!boundToFields) setSubmitError(error);
    }
  });

  const isSubmitting = form.formState.isSubmitting;
  const startDate = form.watch("startDate");
  const endDate = form.watch("endDate");

  // Documented validation rule 2, checked as a courtesy. The server is the
  // authority — the list this compares against is not guaranteed to contain
  // every year that exists, since no `isDeleted` field is documented.
  const overlap = existingYears
    ? findOverlappingYear(existingYears, { startDate, endDate }, editingId)
    : null;

  const preview = academicYearProgress({ startDate, endDate });

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {submitError ? (
          <Alert variant="destructive">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>Couldn&apos;t save the academic year</AlertTitle>
            <AlertDescription>{getErrorMessage(submitError)}</AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 pt-4">
            <div className="sm:max-w-sm">
              <TextField
                control={form.control}
                name="name"
                label="Name"
                placeholder="2025-26"
                description="How this year is referred to across the system. No format is imposed — the backend documents none."
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-1">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Branch
              </p>
              <p className="text-foreground text-sm">
                {branchName ?? defaultValues.branchId}
              </p>
              <p className="text-muted-foreground text-sm">
                Every academic year belongs to one branch, and this is taken
                from the active workspace. Moving a year between branches is a
                migration rather than an edit, so it is not offered here.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <CalendarRange aria-hidden="true" className="size-4" />
              Date range
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                control={form.control}
                name="startDate"
                type="date"
                label="Start date"
                description="The first day of the year."
                disabled={isSubmitting}
              />
              <TextField
                control={form.control}
                name="endDate"
                type="date"
                label="End date"
                description="The last day of the year. Must fall after the start date."
                disabled={isSubmitting}
              />
            </div>

            {preview.totalDays !== null ? (
              <p className="text-muted-foreground text-sm">
                {preview.totalDays} days, from {formatDate(startDate)} to{" "}
                {formatDate(endDate)}.
              </p>
            ) : null}

            {overlap ? (
              <Banner
                tone="warning"
                icon={TriangleAlert}
                title="This range overlaps an existing year"
                description={`“${overlap.name}” already covers ${formatDate(overlap.startDate)} – ${formatDate(overlap.endDate)}. The backend documents that academic years within the same branch cannot overlap, so this will most likely be refused.`}
              />
            ) : null}

            <BackendPendingNote>
              terms, semesters, holidays and exam windows have no field and no
              endpoint anywhere in the contract, so a year is defined only by
              its name and its two dates.
            </BackendPendingNote>
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            data-guide={submitGuideTarget}
          >
            {isSubmitting ? <Spinner size="sm" label="Saving" /> : null}
            {isSubmitting ? "Saving…" : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
