"use client";

import { useState } from "react";

import { TriangleAlert } from "@/assets/icons";
import {
  Form,
  SelectField,
  SwitchField,
  TextField,
  TextareaField,
  applyServerFieldErrors,
  useZodForm,
} from "@/components/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErrorMessage } from "@/lib";
import { BackendPendingNote, Banner, Spinner } from "@/shared/components/feedback";

import { ACADEMIC_UNIT_TYPE_OPTIONS, NO_PARENT } from "../constants";
import {
  academicUnitFormSchema,
  findDuplicateSibling,
  type AcademicUnitFormValues,
} from "../schemas/academic-unit.schema";
import type { AcademicUnitDto } from "../types/academic-unit.dto";
import { eligibleParents } from "../utils/academic-unit-hierarchy";

export interface AcademicUnitFormProps {
  defaultValues: AcademicUnitFormValues;
  submitLabel: string;
  onSubmit: (values: AcademicUnitFormValues) => Promise<unknown>;
  onCancel: () => void;
  /**
   * The program selector, supplied **by the route**.
   *
   * A unit's request body names a `programId`, but the program list belongs to
   * another feature and a feature may not import another feature. So the route
   * renders `<ProgramPicker />` from the Program module and passes it here as
   * an opaque node; it binds itself to this form through `useFormContext()`,
   * because `Form` is React Hook Form's `FormProvider`.
   *
   * When absent — which should not happen in the app, but is entirely possible
   * in a test or a future embedding — the form falls back to a disabled field
   * with a pending note rather than silently submitting an empty `programId`.
   */
  programPicker?: React.ReactNode;
  /** The scope's existing units, for the parent picker and sibling uniqueness. */
  existingUnits?: readonly AcademicUnitDto[];
  /** The record being edited, so it cannot parent or duplicate itself. */
  editingId?: string;
  /** Names the workspace scope in the caption. */
  scopeLabel?: string;
}

/**
 * Create or edit an academic unit.
 *
 * One form for both, because create and update take identical bodies — the only
 * difference is which mutation the route hands in.
 *
 * The fields are exactly the ten the Postman request defines, minus `level`,
 * which the documentation forbids setting. Three of the four documented rule
 * groups are enforced by the **shape of the controls** rather than by a check:
 *
 * - **Existence:** branch and academic year come from the workspace scope the
 *   list was fetched with; the program comes from a picker of real programs.
 * - **Consistency:** the parent picker offers only units in the same program,
 *   and branch and year are fixed by the scope, so all three ids necessarily
 *   match the parent's.
 * - **Tree:** the record and its descendants are excluded from the picker, so
 *   self-parenting and cycles cannot be expressed.
 *
 * Sibling-name uniqueness warns rather than blocks — the loaded list is not
 * guaranteed to be every unit that exists.
 */
export function AcademicUnitForm({
  defaultValues,
  submitLabel,
  onSubmit,
  onCancel,
  programPicker,
  existingUnits,
  editingId,
  scopeLabel,
}: AcademicUnitFormProps) {
  const [submitError, setSubmitError] = useState<unknown>(null);

  const form = useZodForm(academicUnitFormSchema, {
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
  const programId = form.watch("programId");
  const parentId = form.watch("parentId");
  const name = form.watch("name");

  const parentOptions = [
    { value: NO_PARENT, label: "No parent — top of the program" },
    ...eligibleParents(existingUnits ?? [], programId, editingId).map((unit) => ({
      value: unit.id,
      label: unit.name,
      hint: unit.unitType ?? undefined,
    })),
  ];

  const duplicate = existingUnits
    ? findDuplicateSibling(
        existingUnits,
        { name, parentId: parentId === NO_PARENT ? null : parentId },
        editingId,
      )
    : null;

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {submitError ? (
          <Alert variant="destructive">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>Couldn&apos;t save the academic unit</AlertTitle>
            <AlertDescription>{getErrorMessage(submitError)}</AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Placement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 pt-4">
            <div className="sm:max-w-md">
              {programPicker ?? (
                <div className="space-y-2">
                  <SelectField
                    control={form.control}
                    name="programId"
                    label="Program"
                    options={[]}
                    placeholder="Program list unavailable"
                    disabled
                  />
                  <BackendPendingNote>
                    the program selector is supplied by the route. Without it
                    this form cannot name a program, and <code>programId</code>{" "}
                    is a required field on both request bodies.
                  </BackendPendingNote>
                </div>
              )}
            </div>

            <div className="sm:max-w-md">
              <SelectField
                control={form.control}
                name="parentId"
                label="Parent unit"
                options={parentOptions}
                description="Optional. A unit with no parent sits at the top of its program's structure."
                disabled={isSubmitting || !programId}
              />
            </div>

            <p className="text-muted-foreground text-sm">
              Only units in the same program are offered, and a unit can never
              be given itself or one of its own descendants as a parent — the
              consistency and tree rules the backend documents. Branch and
              academic year are fixed by the active workspace
              {scopeLabel ? ` (${scopeLabel})` : ""}.
            </p>

            {duplicate ? (
              <Banner
                tone="warning"
                icon={TriangleAlert}
                title="A sibling already uses this name"
                description={`“${duplicate.name}” already sits under the same parent. The backend documents that siblings sharing a parent and academic year must have strictly unique names, so this will most likely be refused.`}
              />
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Identity</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 pt-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="name"
              label="Name"
              placeholder="Div A"
              disabled={isSubmitting}
            />
            <TextField
              control={form.control}
              name="code"
              label="Code"
              placeholder="HHS-001"
              description="Optional."
              disabled={isSubmitting}
            />
            <SelectField
              control={form.control}
              name="unitType"
              label="Unit type"
              options={ACADEMIC_UNIT_TYPE_OPTIONS}
              placeholder="Select a unit type"
              description="Optional. A display tag, sent as the backend's own constant."
              disabled={isSubmitting}
            />
            <TextField
              control={form.control}
              name="displayOrder"
              label="Display order"
              placeholder="1"
              description="Optional. Orders this unit among its siblings."
              disabled={isSubmitting}
            />
            <div className="sm:col-span-2">
              <SwitchField
                control={form.control}
                name="isActive"
                label="Active"
                description="Whether this unit is in use for the current academic year."
                disabled={isSubmitting}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <TextareaField
              control={form.control}
              name="metadata"
              label="Metadata (JSON)"
              placeholder={'{\n  "roomCapacity": 40\n}'}
              description="Optional. A JSON object, or leave blank."
              rows={6}
              disabled={isSubmitting}
            />
            <BackendPendingNote>
              the documentation describes this as a free-form field for
              attributes that need no strict schema — room capacities, minimum
              students, lab requirements, shift timings — and names no keys. A
              structured editor would be a schema this app invented, so the raw
              JSON is edited directly.
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
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Spinner size="sm" label="Saving" /> : null}
            {isSubmitting ? "Saving…" : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
