"use client";

import { useState } from "react";

import { TriangleAlert } from "@/assets/icons";
import {
  Form,
  SelectField,
  TextField,
  applyServerFieldErrors,
  useZodForm,
} from "@/components/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErrorMessage } from "@/lib";
import { BackendPendingNote, Banner, Spinner } from "@/shared/components/feedback";

import { NO_PARENT } from "../constants";
import {
  findDuplicateProgram,
  programFormSchema,
  type ProgramFormValues,
} from "../schemas/program.schema";
import type { ProgramDto } from "../types/program.dto";
import { eligibleParents } from "../utils/program-hierarchy";

export interface ProgramFormProps {
  defaultValues: ProgramFormValues;
  submitLabel: string;
  onSubmit: (values: ProgramFormValues) => Promise<unknown>;
  onCancel: () => void;
  /** The branch this program belongs to, for the locked caption. */
  branchName?: string;
  /** The branch's existing programs, for the parent picker and rule 1. */
  existingPrograms?: readonly ProgramDto[];
  /** The record being edited, so it cannot parent or duplicate itself. */
  editingId?: string;
  /** `data-guide` target for the submit button — set only by the create
   * screen, whose guide step points at it. */
  submitGuideTarget?: string;
}

/**
 * Create or edit a program.
 *
 * One form for both, because create and update take identical bodies — the only
 * difference is which mutation the route hands in.
 *
 * The fields are exactly the six the Postman request defines. Two of the four
 * documented validation rules are enforced by the **shape of the controls**
 * rather than by a check, which is the better place for them:
 *
 * - **Rule 2, same-branch hierarchy:** the parent list is one branch's, because
 *   that is the only way the endpoint returns programs. The rule cannot be
 *   broken from here.
 * - **Rule 3, circular prevention:** `eligibleParents` removes the record
 *   itself and every one of its descendants, so the picker cannot offer a
 *   choice the server will refuse.
 *
 * Rule 1 (uniqueness of `branchId + name + medium + stream`) is checked as a
 * courtesy and warns rather than blocks — the list it compares against is not
 * guaranteed to be every program that exists.
 *
 * `branchId` is not a control. It is a documented required field, but it comes
 * from the active workspace and is fixed when editing: rule 2 scopes the
 * hierarchy per branch, and moving a program between branches would strand the
 * academic units that name it.
 */
export function ProgramForm({
  defaultValues,
  submitLabel,
  onSubmit,
  onCancel,
  branchName,
  existingPrograms,
  editingId,
  submitGuideTarget,
}: ProgramFormProps) {
  const [submitError, setSubmitError] = useState<unknown>(null);

  const form = useZodForm(programFormSchema, {
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
  const name = form.watch("name");
  const medium = form.watch("medium");
  const stream = form.watch("stream");

  const parentOptions = [
    { value: NO_PARENT, label: "No parent — top level" },
    ...eligibleParents(existingPrograms ?? [], editingId).map((program) => ({
      value: program.id,
      label: program.name,
      hint:
        [program.medium, program.stream].filter(Boolean).join(" · ") ||
        undefined,
    })),
  ];

  const duplicate = existingPrograms
    ? findDuplicateProgram(existingPrograms, { name, medium, stream }, editingId)
    : null;

  return (
    <Form {...form}>
      <form
        onSubmit={handleSubmit}
        noValidate
        className="space-y-6"
        data-guide={submitGuideTarget}
      >
        {submitError ? (
          <Alert variant="destructive">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>Couldn&apos;t save the program</AlertTitle>
            <AlertDescription>{getErrorMessage(submitError)}</AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 pt-4">
            <div className="sm:max-w-md">
              <TextField
                control={form.control}
                name="name"
                label="Program name"
                placeholder="Higher Secondary Science"
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
                A program is a vertical structure inside one branch, taken from
                the active workspace. Moving it between branches would strand
                the academic units that reference it, so it is not offered.
              </p>
            </div>

            {duplicate ? (
              <Banner
                tone="warning"
                icon={TriangleAlert}
                title="A program with this combination already exists"
                description={`“${duplicate.name}” already uses this name, medium and stream. The backend documents that the combination must be unique per branch, so this will most likely be refused.`}
              />
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Classification</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 pt-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="medium"
              label="Medium"
              placeholder="English"
              description="Optional. Part of the documented uniqueness rule."
              disabled={isSubmitting}
            />
            <TextField
              control={form.control}
              name="stream"
              label="Stream"
              placeholder="Science (PCM)"
              description="Optional. Part of the documented uniqueness rule."
              disabled={isSubmitting}
            />
            <div className="space-y-2 sm:col-span-2">
              <TextField
                control={form.control}
                name="level"
                label="Level"
                placeholder="SCHOOL"
                description="Optional. Free text."
                disabled={isSubmitting}
              />
              <BackendPendingNote>
                <code>level</code> appears in the Postman request body but in no
                part of the module documentation, including its uniqueness rule.
                The only recorded value is <code>SCHOOL</code>, which is one
                sample rather than a value set — so this is free text and not a
                dropdown.
              </BackendPendingNote>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Hierarchy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <SelectField
              control={form.control}
              name="parentId"
              label="Parent program"
              options={parentOptions}
              description="Optional. Programs may be grouped, as in School → Primary."
              disabled={isSubmitting}
              className="sm:max-w-md"
            />
            <p className="text-muted-foreground text-sm">
              Only programs in this branch are offered, and a program can never
              be given itself or one of its own descendants as a parent — the
              two hierarchy rules the backend documents.
            </p>
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
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Spinner size="sm" label="Saving" /> : null}
            {isSubmitting ? "Saving…" : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
