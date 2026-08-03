"use client";

import { useRouter } from "next/navigation";

import { ROUTES } from "@/constants";
import { ApiErrorState, FormSkeleton } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";

import {
  useMaintenanceRule,
  useUpdateMaintenanceRule,
} from "../hooks/use-maintenance-rules";
import { toRuleFormValues, toRuleRequest } from "../mappers/maintenance.mapper";
import { MaintenanceRuleForm } from "./maintenance-rule-form";

export interface EditRuleScreenProps {
  ruleId: string;
}

/**
 * Edit an existing maintenance rule.
 *
 * The form is only mounted once the rule has loaded, so `defaultValues` is the
 * real record rather than blanks that get reset a moment later — resetting a
 * form the user may already be typing into is how edits get silently discarded.
 */
export function EditRuleScreen({ ruleId }: EditRuleScreenProps) {
  const router = useRouter();
  const { data: rule, isPending, error, refetch } = useMaintenanceRule(ruleId);
  const update = useUpdateMaintenanceRule(ruleId);

  return (
    <div className="space-y-6">
      <PageHeader
        title={rule?.title?.trim() || "Edit maintenance rule"}
        description="Changes take effect as soon as they are saved."
      />

      {isPending ? <FormSkeleton fields={6} label="Loading rule" /> : null}

      {error ? <ApiErrorState error={error} onRetry={() => refetch()} /> : null}

      {rule ? (
        <MaintenanceRuleForm
          defaultValues={toRuleFormValues(rule)}
          submitLabel="Save changes"
          onCancel={() => router.push(ROUTES.app.maintenance.root)}
          onSubmit={async (values) => {
            await update.mutateAsync(toRuleRequest(values));
            router.push(ROUTES.app.maintenance.root);
          }}
        />
      ) : null}
    </div>
  );
}
