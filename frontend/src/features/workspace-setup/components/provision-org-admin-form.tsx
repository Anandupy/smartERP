"use client";

import { useState } from "react";

import { TriangleAlert } from "@/assets/icons";
import {
  Form,
  PasswordField,
  SelectField,
  TextField,
  applyServerFieldErrors,
  useZodForm,
} from "@/components/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { SelectFieldOption } from "@/components/form";
import { getErrorMessage } from "@/lib";
import { Spinner } from "@/shared/components/feedback";

import { useProvisionOrgAdmin } from "../hooks/use-provision-org-admin";
import { toCreateOrgAdminRequest } from "../mappers/provision-org-admin.mapper";
import {
  provisionOrgAdminFormDefaults,
  provisionOrgAdminFormSchema,
  type ProvisionOrgAdminFormValues,
} from "../schemas/provision-org-admin.schema";
import type { ProvisionedAdminDto } from "../types/provision-org-admin.dto";

export interface ProvisionOrgAdminFormProps {
  /** Organizations already on offer, so the admin can be scoped immediately. */
  organizationOptions: SelectFieldOption[];
  onProvisioned?: (admin: ProvisionedAdminDto) => void;
}

/**
 * Path B: create an `ORG_ADMIN` who will complete the rest of the client's
 * setup, via the existing `POST /users` (no separate identity system — see
 * `docs/workspace-setup-module.md` §"ORG_ADMIN provisioning").
 *
 * `organizationId` is left blank rather than required when no organization
 * exists yet — `CreateUserDto.organizationId` is genuinely optional, and an
 * admin can be scoped to one afterward. Blank submits as `undefined`, never
 * `""` (see the mapper).
 */
export function ProvisionOrgAdminForm({
  organizationOptions,
  onProvisioned,
}: ProvisionOrgAdminFormProps) {
  const [submitError, setSubmitError] = useState<unknown>(null);
  const provision = useProvisionOrgAdmin();

  const form = useZodForm(provisionOrgAdminFormSchema, {
    defaultValues: provisionOrgAdminFormDefaults(),
    mode: "onSubmit",
  });

  const handleSubmit = form.handleSubmit(
    async (values: ProvisionOrgAdminFormValues) => {
      setSubmitError(null);
      try {
        const admin = await provision.mutateAsync(
          toCreateOrgAdminRequest(values),
        );
        form.reset(provisionOrgAdminFormDefaults());
        onProvisioned?.(admin);
      } catch (error) {
        const boundToFields = applyServerFieldErrors(error, form.setError);
        if (!boundToFields) setSubmitError(error);
      }
    },
  );

  const isSubmitting = form.formState.isSubmitting;

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {submitError ? (
          <Alert variant="destructive">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>Could not create the administrator</AlertTitle>
            <AlertDescription>{getErrorMessage(submitError)}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            control={form.control}
            name="fullName"
            label="Full name"
            disabled={isSubmitting}
          />
          <TextField
            control={form.control}
            name="username"
            label="Username"
            description="Letters, numbers and underscores only."
            disabled={isSubmitting}
          />
          <TextField
            control={form.control}
            name="email"
            type="email"
            label="Email"
            disabled={isSubmitting}
          />
          <TextField
            control={form.control}
            name="phone"
            type="tel"
            label="Phone"
            disabled={isSubmitting}
          />
          <PasswordField
            control={form.control}
            name="password"
            label="Temporary password"
            description="At least 8 characters. Share it with them securely."
            autoComplete="new-password"
            disabled={isSubmitting}
          />
          {organizationOptions.length > 0 ? (
            <SelectField
              control={form.control}
              name="organizationId"
              label="Organization"
              description="Optional — can be assigned later instead."
              placeholder="No organization yet"
              options={organizationOptions}
              disabled={isSubmitting}
            />
          ) : null}
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Spinner size="sm" label="Creating" /> : null}
            {isSubmitting ? "Creating…" : "Create administrator"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
