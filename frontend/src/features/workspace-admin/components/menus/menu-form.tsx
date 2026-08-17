"use client";

import { useState } from "react";

import { TriangleAlert } from "@/assets/icons";
import {
  Form,
  SelectField,
  TextField,
  TextareaField,
  applyServerFieldErrors,
  useZodForm,
} from "@/components/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib";
import { Spinner } from "@/shared/components/feedback";

import { MENU_STATUSES, PERMISSION_MODES } from "../../types/menu.dto";
import type { ModuleListItemDto } from "../../types/module.dto";
import type { MenuListItemDto } from "../../types/menu.dto";
import { NO_PARENT, menuFormSchema, type MenuFormValues } from "../../schemas/menu.schema";

export interface MenuFormProps {
  defaultValues: MenuFormValues;
  submitLabel: string;
  onSubmit: (values: MenuFormValues) => Promise<unknown>;
  onCancel: () => void;
  modules: ModuleListItemDto[];
  /** Eligible parents within the form's current module — already excludes self/descendants/depth violations. */
  parentOptions: MenuListItemDto[];
  /** Editing never reassigns a menu's module — that is the Move action's job. */
  lockModule?: boolean;
}

/**
 * Create or edit a menu.
 *
 * Fields mirror `CreateMenuDto` exactly — `permissions` and `searchKeywords`
 * are edited as comma-separated text (see `schemas/menu.schema.ts` for why) and
 * split into arrays by `mappers/menu.mapper.ts` at submit time.
 */
export function MenuForm({
  defaultValues,
  submitLabel,
  onSubmit,
  onCancel,
  modules,
  parentOptions,
  lockModule = false,
}: MenuFormProps) {
  const [submitError, setSubmitError] = useState<unknown>(null);

  const form = useZodForm(menuFormSchema, { defaultValues, mode: "onSubmit" });
  const isSubmitting = form.formState.isSubmitting;

  const handleSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await onSubmit(values);
    } catch (error) {
      const boundToFields = applyServerFieldErrors(error, form.setError);
      if (!boundToFields) setSubmitError(error);
    }
  });

  const moduleOptions = modules.map((module) => ({
    value: module.id,
    label: module.name,
    hint: module.code,
  }));

  const parentSelectOptions = [
    { value: NO_PARENT, label: "None — top level" },
    ...parentOptions.map((menu) => ({ value: menu.id, label: menu.displayName })),
  ];

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {submitError ? (
          <Alert variant="destructive">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>Couldn&apos;t save the menu</AlertTitle>
            <AlertDescription>{getErrorMessage(submitError)}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            control={form.control}
            name="displayName"
            label="Display name"
            placeholder="Applicants List"
            disabled={isSubmitting}
          />
          <TextField
            control={form.control}
            name="code"
            label="Code"
            placeholder="ADMISSIONS_APPLICANTS"
            description="Uppercase letters, numbers and underscores only. Unique."
            disabled={isSubmitting}
          />
          <TextField
            control={form.control}
            name="route"
            label="Route"
            placeholder="/admissions/applicants"
            disabled={isSubmitting}
          />
          <TextField
            control={form.control}
            name="componentIdentifier"
            label="Component identifier"
            placeholder="ApplicantsListContainer"
            description="Optional. Names the frontend component that renders this route."
            disabled={isSubmitting}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            control={form.control}
            name="moduleId"
            label="Module"
            options={moduleOptions}
            placeholder="Select a module…"
            description={
              lockModule
                ? "Locked. Use “Move” to reassign a menu to a different module."
                : undefined
            }
            disabled={isSubmitting || lockModule}
          />
          <SelectField
            control={form.control}
            name="parentId"
            label="Parent"
            options={parentSelectOptions}
            description="Only menus that would not create a cycle or exceed the 3-level depth limit are offered."
            disabled={isSubmitting}
          />
          <TextField
            control={form.control}
            name="displayOrder"
            type="number"
            label="Display order"
            disabled={isSubmitting}
          />
          <SelectField
            control={form.control}
            name="status"
            label="Status"
            options={MENU_STATUSES.map((status) => ({ value: status, label: status }))}
            description="Only ACTIVE and BETA ever reach a user's navigation."
            disabled={isSubmitting}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            control={form.control}
            name="icon"
            label="Icon name"
            placeholder="users"
            description="Optional."
            disabled={isSubmitting}
          />
          <TextField
            control={form.control}
            name="badge"
            label="Badge"
            placeholder="NEW"
            description="Optional. Free text, rendered beside the title."
            disabled={isSubmitting}
          />
          <TextField
            control={form.control}
            name="tooltip"
            label="Tooltip"
            description="Optional."
            disabled={isSubmitting}
          />
        </div>

        <TextareaField
          control={form.control}
          name="description"
          label="Description"
          description="Optional."
          disabled={isSubmitting}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            control={form.control}
            name="permissionsText"
            label="Required permissions"
            placeholder="admissions.view, admissions.manage"
            description="Comma-separated permission keys. Empty means every authenticated user."
            disabled={isSubmitting}
          />
          <SelectField
            control={form.control}
            name="permissionMode"
            label="Permission mode"
            options={PERMISSION_MODES.map((mode) => ({
              value: mode,
              label: mode === "ALL" ? "ALL — every permission required" : "ANY — one permission is enough",
            }))}
            disabled={isSubmitting}
          />
        </div>

        <TextField
          control={form.control}
          name="searchKeywordsText"
          label="Search keywords"
          placeholder="students, applicants, registration"
          description="Comma-separated. Extra terms that match this menu in a command palette."
          disabled={isSubmitting}
        />

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}>
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
