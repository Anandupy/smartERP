"use client";

import { useRouter } from "next/navigation";

import { Hash } from "@/assets/icons";
import { ROUTES } from "@/constants";
import { ApiErrorState, EmptyState, FormSkeleton } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";

import { useNumberingConfig, useUpdateNumberingConfig } from "../hooks/use-numbering";
import { toNumberingConfigFormValues, toUpdateNumberingConfigRequest } from "../mappers/numbering.mapper";
import { purposeLabel } from "../constants";
import { NumberingConfigForm } from "./numbering-config-form";

export interface EditNumberingConfigScreenProps {
  id: string;
}

/**
 * Edit a `NumberingConfig`. Resolved out of the list read — no `GET /:id`
 * is documented for this resource (the same pattern Academic Year's
 * missing detail read established, AGENTS.md §28).
 */
export function EditNumberingConfigScreen({ id }: EditNumberingConfigScreenProps) {
  const router = useRouter();
  const { config, isPending, error, refetch } = useNumberingConfig(id);
  const update = useUpdateNumberingConfig(id);
  const listHref = ROUTES.app.settings.numbering.root;

  if (isPending) {
    return <FormSkeleton fields={6} label="Loading sequence" />;
  }

  if (error) {
    return <ApiErrorState error={error} onRetry={() => refetch()} />;
  }

  if (!config) {
    return (
      <EmptyState
        icon={Hash}
        title="Sequence not found"
        description="It is not in this scope's list — it may belong to a different branch, or the id is wrong."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Edit sequence" description={purposeLabel(config.purpose)} />

      <NumberingConfigForm
        defaultValues={toNumberingConfigFormValues(config)}
        submitLabel="Save changes"
        purposeEditable={false}
        onCancel={() => router.push(listHref)}
        onSubmit={async (values) => {
          await update.mutateAsync(toUpdateNumberingConfigRequest(values));
          router.push(listHref);
        }}
      />
    </div>
  );
}
