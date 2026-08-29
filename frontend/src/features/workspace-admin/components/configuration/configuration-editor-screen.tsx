"use client";

import { useEffect, useState } from "react";

import { Info, Layers, Settings, TriangleAlert } from "@/assets/icons";
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
import { usePermissions } from "@/core/auth";
import { useGuide, GuideHelpTrigger } from "@/core/guides";
import { useWorkspace } from "@/core/workspace";
import { getErrorMessage } from "@/lib";
import {
  ApiErrorState,
  Banner,
  ForbiddenState,
  Spinner,
} from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";

import { SCOPE_TYPE_LABELS } from "../../constants";
import { useConfiguration, useUpsertConfiguration } from "../../hooks/use-configuration";
import {
  toConfigurationFormValues,
  toConfigurationRequest,
} from "../../mappers/configuration.mapper";
import {
  UNSET,
  configurationFormDefaults,
  configurationFormSchema,
} from "../../schemas/configuration.schema";
import {
  WORKSPACE_ROLE_NAMES,
  WORKSPACE_SCOPE_TYPES,
} from "../../types/configuration.dto";
import { SetupStatusBanner } from "../setup-status-banner";

const TRI_STATE_OPTIONS = [
  { value: UNSET, label: "Leave unchanged" },
  { value: "true", label: "On" },
  { value: "false", label: "Off" },
];

/**
 * The Configuration Layer Editor — S10.
 *
 * Gated on `SUPER_ADMIN` via `usePermissions()`, mirroring the backend's own
 * `@Roles(UserRole.SUPER_ADMIN)` on `POST /workspace/configuration` — frontend
 * authorization is UX only, and a 403 from the API still surfaces plainly if
 * this check is ever stale.
 *
 * `GET /workspace/configuration/:scopeType` (added 2026-08-21) reads a layer
 * back by its exact scope key, so the form now loads existing values before
 * editing — `useConfiguration` runs whenever the chosen scope resolves to a
 * lookup key, and the effect below resets the form to what it finds. There is
 * still no `list`/`DELETE`, and saving still merges rather than replaces (see
 * `schemas/configuration.schema.ts` on why every preference is tri-state).
 */
export function ConfigurationEditorScreen() {
  const { hasRole } = usePermissions();
  const isSuperAdmin = hasRole("SUPER_ADMIN");
  const { options } = useWorkspace();
  const upsert = useUpsertConfiguration();
  const guide = useGuide("workspace-configuration");
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const form = useZodForm(configurationFormSchema, {
    defaultValues: configurationFormDefaults(),
    mode: "onSubmit",
  });

  const scopeType = form.watch("scopeType");
  const scopeId = form.watch("scopeId");
  const effectiveScopeId = scopeType === "PRODUCT" ? null : scopeId || null;

  const configQuery = useConfiguration(scopeType, effectiveScopeId, {
    enabled: isSuperAdmin,
  });

  useEffect(() => {
    if (configQuery.isSuccess) {
      form.reset(toConfigurationFormValues(scopeType, scopeId, configQuery.data));
    }
    // `form` is a stable react-hook-form instance; re-running only when the
    // fetched layer (or the scope it was fetched for) actually changes keeps
    // this from fighting the user's own in-progress edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configQuery.data, configQuery.isSuccess, scopeType, scopeId]);

  if (!isSuperAdmin) {
    return (
      <ForbiddenState description="Workspace configuration is Super Admin only — the backend enforces this on POST /workspace/configuration." />
    );
  }

  const isSubmitting = form.formState.isSubmitting || upsert.isPending;

  const handleSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    setLastSaved(null);
    try {
      const saved = await upsert.mutateAsync(toConfigurationRequest(values));
      setLastSaved(saved.id);
      guide.completeGuide();
    } catch (error) {
      const boundToFields = applyServerFieldErrors(error, form.setError);
      if (!boundToFields) setSubmitError(error);
    }
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuration Layer Editor"
        description="Define or extend one layer of the workspace's presentation configuration."
        actions={<GuideHelpTrigger guideId="workspace-configuration" />}
      />

      <SetupStatusBanner enabled={isSuperAdmin} />

      {configQuery.isError ? (
        <ApiErrorState
          error={configQuery.error}
          onRetry={() => configQuery.refetch()}
        />
      ) : configQuery.isFetching ? (
        <Banner
          tone="info"
          icon={Info}
          title="Loading existing configuration for this scope…"
        />
      ) : configQuery.data ? (
        <Banner
          tone="success"
          icon={Info}
          title={`Editing existing layer ${configQuery.data.id}`}
          description="Loaded values below reflect what's currently stored for this scope. Saving still merges rather than replaces: a field left on “Leave unchanged” is never sent, so it stays untouched."
        />
      ) : configQuery.isSuccess ? (
        <Banner
          tone="info"
          icon={Info}
          title="No configuration layer exists yet for this scope"
          description="Saving below will create one. A field left on “Leave unchanged” is omitted from the request rather than sent as empty."
        />
      ) : (
        <Banner
          tone="warning"
          icon={TriangleAlert}
          title="Choose a scope to load its existing configuration"
          description="Every save merges into whatever already exists for the chosen scope, one level deep — pick a scope above to see it first."
        />
      )}

      <Card data-guide="workspace-configuration-merge-order">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Layers aria-hidden="true" className="size-4" />
            Merge order
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <ol className="flex flex-wrap items-center gap-2 text-sm">
            {WORKSPACE_SCOPE_TYPES.map((scope, index) => (
              <li key={scope} className="flex items-center gap-2">
                <span
                  className={
                    scope === scopeType
                      ? "border-primary bg-primary/10 text-primary rounded-md border px-2 py-1 font-medium"
                      : "text-muted-foreground rounded-md border px-2 py-1"
                  }
                >
                  {SCOPE_TYPE_LABELS[scope]}
                </span>
                {index < WORKSPACE_SCOPE_TYPES.length - 1 ? (
                  <span aria-hidden="true" className="text-muted-foreground">
                    →
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
          <p className="text-muted-foreground mt-2 text-sm">
            Later layers override earlier ones for whichever keys they set. The
            layer highlighted above is the one this save will affect.
          </p>
        </CardContent>
      </Card>

      <Form {...form}>
        <form
          onSubmit={handleSubmit}
          noValidate
          className="space-y-6"
          data-guide="workspace-configuration-submit"
        >
          {submitError ? (
            <Alert variant="destructive">
              <TriangleAlert aria-hidden="true" />
              <AlertTitle>Couldn&apos;t save the configuration layer</AlertTitle>
              <AlertDescription>{getErrorMessage(submitError)}</AlertDescription>
            </Alert>
          ) : null}

          {lastSaved ? (
            <Alert>
              <Info aria-hidden="true" />
              <AlertTitle>Layer saved</AlertTitle>
              <AlertDescription>
                Saved as configuration id <code>{lastSaved}</code>. It merged
                into any existing layer for this scope.
              </AlertDescription>
            </Alert>
          ) : null}

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Scope</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 pt-4 sm:grid-cols-2">
              <SelectField
                control={form.control}
                name="scopeType"
                label="Scope type"
                options={WORKSPACE_SCOPE_TYPES.map((scope) => ({
                  value: scope,
                  label: SCOPE_TYPE_LABELS[scope],
                }))}
                disabled={isSubmitting}
              />

              {scopeType === "PRODUCT" ? (
                <p className="text-muted-foreground self-end text-sm">
                  Product is the global default — no scope id is needed.
                </p>
              ) : scopeType === "ORGANIZATION" ? (
                <SelectField
                  control={form.control}
                  name="scopeId"
                  label="Organization"
                  options={options.organizations.map((organization) => ({
                    value: organization.id,
                    label: organization.name,
                  }))}
                  placeholder="Select an organization…"
                  disabled={isSubmitting}
                />
              ) : scopeType === "BRANCH" ? (
                <SelectField
                  control={form.control}
                  name="scopeId"
                  label="Branch"
                  options={options.branches.map((branch) => ({
                    value: branch.id,
                    label: branch.name,
                  }))}
                  placeholder="Select a branch…"
                  description="Branches of your currently active organization. Switch workspace to target a branch elsewhere."
                  disabled={isSubmitting}
                />
              ) : scopeType === "ROLE" ? (
                <SelectField
                  control={form.control}
                  name="scopeId"
                  label="Role"
                  options={WORKSPACE_ROLE_NAMES.map((role) => ({
                    value: role,
                    label: role,
                  }))}
                  placeholder="Select a role…"
                  disabled={isSubmitting}
                />
              ) : (
                <TextField
                  control={form.control}
                  name="scopeId"
                  label="User id"
                  placeholder="019fa012-…"
                  description="The target user's id."
                  disabled={isSubmitting}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <Settings aria-hidden="true" className="size-4" />
                Navigation preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 pt-4 sm:grid-cols-2">
              <SelectField
                control={form.control}
                name="sidebarCollapsed"
                label="Sidebar collapsed"
                options={TRI_STATE_OPTIONS}
                disabled={isSubmitting}
              />
              <SelectField
                control={form.control}
                name="denseMode"
                label="Dense mode"
                options={TRI_STATE_OPTIONS}
                disabled={isSubmitting}
              />
              <SelectField
                control={form.control}
                name="themeMode"
                label="Theme mode"
                options={[
                  { value: "", label: "Leave unchanged" },
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                  { value: "system", label: "System" },
                ]}
                disabled={isSubmitting}
              />
              <TextField
                control={form.control}
                name="defaultRoute"
                label="Default route"
                placeholder="/app"
                description="Leave blank to leave unchanged."
                disabled={isSubmitting}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Client preferences</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 pt-4 sm:grid-cols-2">
              <SelectField
                control={form.control}
                name="theme"
                label="Theme"
                options={[
                  { value: "", label: "Leave unchanged" },
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                  { value: "system", label: "System" },
                ]}
                disabled={isSubmitting}
              />
              <TextField
                control={form.control}
                name="locale"
                label="Locale"
                placeholder="en"
                description="Leave blank to leave unchanged."
                disabled={isSubmitting}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Spinner size="sm" label="Saving" /> : null}
              {isSubmitting ? "Saving…" : "Save configuration layer"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
