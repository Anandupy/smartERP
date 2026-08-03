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
import { useWorkspace } from "@/core/workspace";
import { getErrorMessage } from "@/lib";
import { Spinner } from "@/shared/components/feedback";

import {
  DAY_OF_WEEK_OPTIONS,
  SCOPE_OPTIONS,
  SCOPE_PRESENTATION,
} from "../constants";
import {
  maintenanceRuleFormSchema,
  type MaintenanceRuleFormValues,
} from "../schemas/maintenance-rule.schema";
import { MaintenanceRulePreview } from "./maintenance-rule-preview";

export interface MaintenanceRuleFormProps {
  defaultValues: MaintenanceRuleFormValues;
  submitLabel: string;
  onSubmit: (values: MaintenanceRuleFormValues) => Promise<unknown>;
  onCancel: () => void;
}

/**
 * Create or edit a maintenance rule.
 *
 * One form for both, because create and update take identical bodies — the
 * only difference is which mutation the route hands in.
 *
 * The layout follows the order the decision is actually made in: **what** the
 * rule covers, **what stays working** while it applies, **when** it applies,
 * and **what people are told**. Access comes second rather than last because
 * the three allow-flags are the part an operator gets wrong — a rule with all
 * three off locks out the person who wrote it.
 *
 * `scopeId` adapts to the scope: organization and campus offer the workspaces
 * the user actually has, module and feature take the identifier the backend
 * matches on. Global takes none, and the mapper sends `null` regardless of what
 * the field still holds.
 */
export function MaintenanceRuleForm({
  defaultValues,
  submitLabel,
  onSubmit,
  onCancel,
}: MaintenanceRuleFormProps) {
  const [submitError, setSubmitError] = useState<unknown>(null);
  const { options } = useWorkspace();

  const form = useZodForm(maintenanceRuleFormSchema, {
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
  const values = form.watch();
  const scope = SCOPE_PRESENTATION[values.scopeType];

  const scopeIdOptions =
    values.scopeType === "ORGANIZATION"
      ? options.organizations.map((entity) => ({
          value: entity.id,
          label: entity.name,
          hint: entity.code ?? undefined,
        }))
      : values.scopeType === "BRANCH"
        ? options.branches.map((entity) => ({
            value: entity.id,
            label: entity.name,
            hint: entity.code ?? undefined,
          }))
        : null;

  const locksEverybodyOut =
    values.isActive &&
    !values.allowLogin &&
    !values.allowReadApis &&
    !values.allowWriteApis;

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {submitError ? (
          <Alert variant="destructive">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>Couldn&apos;t save the rule</AlertTitle>
            <AlertDescription>{getErrorMessage(submitError)}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
          <div className="space-y-6">
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Scope</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-5 pt-4 sm:grid-cols-2">
                <SelectField
                  control={form.control}
                  name="scopeType"
                  label="Applies to"
                  options={SCOPE_OPTIONS}
                  description="Higher levels win: a global rule overrides everything below it."
                  disabled={isSubmitting}
                />

                {values.scopeType === "GLOBAL" ? null : scopeIdOptions ? (
                  <SelectField
                    control={form.control}
                    name="scopeId"
                    label={scope.target ?? "Target"}
                    options={scopeIdOptions}
                    placeholder="Select…"
                    disabled={isSubmitting}
                  />
                ) : (
                  <TextField
                    control={form.control}
                    name="scopeId"
                    label={scope.target ?? "Target"}
                    placeholder={
                      values.scopeType === "MODULE"
                        ? "admissions"
                        : "admission_approval"
                    }
                    description="The identifier the backend matches on."
                    disabled={isSubmitting}
                  />
                )}

                <SwitchField
                  control={form.control}
                  name="isActive"
                  label="Rule is active"
                  description="An inactive rule is saved but never applied."
                  disabled={isSubmitting}
                  className="sm:col-span-2"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b">
                <CardTitle>What stays available</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {locksEverybodyOut ? (
                  <Alert>
                    <TriangleAlert aria-hidden="true" />
                    <AlertTitle>This blocks everything</AlertTitle>
                    <AlertDescription>
                      Sign-in, reads and writes are all disallowed. Super admins
                      always bypass maintenance, and any role listed below can
                      too — everyone else will be locked out entirely.
                    </AlertDescription>
                  </Alert>
                ) : null}

                <SwitchField
                  control={form.control}
                  name="allowLogin"
                  label="Allow sign-in"
                  description="Whether users can authenticate while the rule applies."
                  disabled={isSubmitting}
                />
                <SwitchField
                  control={form.control}
                  name="allowReadApis"
                  label="Allow reads"
                  description="GET, HEAD and OPTIONS requests."
                  disabled={isSubmitting}
                />
                <SwitchField
                  control={form.control}
                  name="allowWriteApis"
                  label="Allow writes"
                  description="POST, PUT, PATCH and DELETE requests."
                  disabled={isSubmitting}
                />

                <div className="grid gap-5 sm:grid-cols-2">
                  <TextField
                    control={form.control}
                    name="customStatus"
                    type="number"
                    label="Response status"
                    description="HTTP status returned to blocked requests."
                    disabled={isSubmitting}
                  />
                  <TextField
                    control={form.control}
                    name="bypassRoles"
                    label="Bypass roles"
                    placeholder="DEVOPS, SYSTEM_ADMIN"
                    description="Comma-separated. Super admins always bypass."
                    disabled={isSubmitting}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b">
                <CardTitle>Schedule</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 pt-4">
                <div className="grid gap-5 sm:grid-cols-2">
                  <TextField
                    control={form.control}
                    name="startAt"
                    type="datetime-local"
                    label="Starts"
                    description="Leave empty to apply immediately."
                    disabled={isSubmitting}
                  />
                  <TextField
                    control={form.control}
                    name="endAt"
                    type="datetime-local"
                    label="Ends"
                    description="Leave empty for no automatic end."
                    disabled={isSubmitting}
                  />
                </div>

                <TextField
                  control={form.control}
                  name="timezone"
                  label="Timezone"
                  placeholder="Asia/Kolkata"
                  description="IANA zone used to evaluate a recurring window."
                  disabled={isSubmitting}
                />

                <SwitchField
                  control={form.control}
                  name="isRecurring"
                  label="Repeat weekly"
                  description="Apply during the same window every week."
                  disabled={isSubmitting}
                />

                {values.isRecurring ? (
                  <div className="grid gap-5 sm:grid-cols-3">
                    <SelectField
                      control={form.control}
                      name="recurrenceDayOfWeek"
                      label="Day"
                      options={DAY_OF_WEEK_OPTIONS}
                      disabled={isSubmitting}
                    />
                    <TextField
                      control={form.control}
                      name="recurrenceStartTime"
                      type="time"
                      label="From"
                      disabled={isSubmitting}
                    />
                    <TextField
                      control={form.control}
                      name="recurrenceEndTime"
                      type="time"
                      label="To"
                      disabled={isSubmitting}
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b">
                <CardTitle>What people are told</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 pt-4">
                <div className="grid gap-5 sm:grid-cols-2">
                  <TextField
                    control={form.control}
                    name="title"
                    label="Title"
                    placeholder="Scheduled system upgrade"
                    disabled={isSubmitting}
                  />
                  <TextField
                    control={form.control}
                    name="shortMessage"
                    label="Short message"
                    placeholder="We'll be back shortly."
                    disabled={isSubmitting}
                  />
                </div>

                <TextareaField
                  control={form.control}
                  name="description"
                  label="Description"
                  rows={3}
                  disabled={isSubmitting}
                />

                <div className="grid gap-5 sm:grid-cols-2">
                  <TextField
                    control={form.control}
                    name="reason"
                    label="Reason"
                    placeholder="Database performance indexing"
                    disabled={isSubmitting}
                  />
                  <TextField
                    control={form.control}
                    name="maintenanceWindow"
                    label="Window (as displayed)"
                    placeholder="Sunday 02:00 – 04:00 IST"
                    disabled={isSubmitting}
                  />
                  <TextField
                    control={form.control}
                    name="estimatedCompletion"
                    label="Estimated completion"
                    disabled={isSubmitting}
                  />
                  <TextField
                    control={form.control}
                    name="supportContact"
                    label="Support contact"
                    placeholder="devops@campusflow.io"
                    disabled={isSubmitting}
                  />
                  <TextField
                    control={form.control}
                    name="severity"
                    label="Severity"
                    placeholder="INFO"
                    description="Free text — the backend documents no value set beyond the sample INFO."
                    disabled={isSubmitting}
                  />
                  <TextField
                    control={form.control}
                    name="bannerColor"
                    label="Banner colour"
                    placeholder="#d32f2f"
                    description="Stored for downstream consumers; this app styles notices from its own tokens."
                    disabled={isSubmitting}
                  />
                  <TextField
                    control={form.control}
                    name="maintenanceIcon"
                    label="Icon"
                    disabled={isSubmitting}
                  />
                  <TextField
                    control={form.control}
                    name="customPage"
                    label="Details page"
                    placeholder="https://status.campusflow.io"
                    disabled={isSubmitting}
                  />
                  <TextField
                    control={form.control}
                    name="announcementLink"
                    label="Announcement link"
                    disabled={isSubmitting}
                  />
                  <TextField
                    control={form.control}
                    name="externalStatusPageUrl"
                    label="External status page"
                    disabled={isSubmitting}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <MaintenanceRulePreview
            values={values}
            className="xl:sticky xl:top-20 xl:self-start"
          />
        </div>

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
