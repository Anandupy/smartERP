"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Eye } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants";
import { ApiErrorState, FormSkeleton } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";

import { useTemplate, useUpdateTemplate } from "../../hooks/use-templates";
import { toTemplateFormValues, toTemplateRequest } from "../../mappers/template.mapper";
import { TemplateForm } from "./template-form";
import { TemplatePreviewDrawer } from "./template-preview-drawer";

export interface EditTemplateScreenProps {
  id: string;
}

/**
 * Edit Template — `PATCH /communication/templates/:id`.
 *
 * The body is always complete: the documented PATCH sample matches create's
 * exactly, so this screen resends every field, seeded from the loaded record.
 * Scope (`organizationId`/`branchId`) and `version` are preserved from the
 * loaded template rather than reset to the active workspace — editing a
 * template must not silently re-scope or re-version it.
 */
export function EditTemplateScreen({ id }: EditTemplateScreenProps) {
  const router = useRouter();
  const { data: template, isPending, error, refetch } = useTemplate(id);
  const update = useUpdateTemplate(id);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  if (isPending) {
    return (
      <div className="space-y-6">
        <PageHeader title="Edit Template" />
        <FormSkeleton fields={6} />
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="space-y-6">
        <PageHeader title="Edit Template" />
        <ApiErrorState error={error} onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit ${template.name ?? "template"}`}
        description={`${template.code ?? ""} · v${template.version ?? 1}`}
        actions={
          <Button type="button" variant="outline" onClick={() => setIsPreviewOpen(true)}>
            <Eye />
            Preview
          </Button>
        }
      />

      <TemplateForm
        defaultValues={toTemplateFormValues(template)}
        submitLabel="Save changes"
        isSubmitting={update.isPending}
        onCancel={() =>
          router.push(ROUTES.app.communication.templates.detail(id))
        }
        onSubmit={async (values) => {
          await update.mutateAsync(
            toTemplateRequest(values, {
              version: template.version ?? 1,
              organizationId: template.organizationId ?? null,
              branchId: template.branchId ?? null,
            }),
          );
          router.push(ROUTES.app.communication.templates.detail(id));
        }}
      />

      <TemplatePreviewDrawer
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        template={template}
      />
    </div>
  );
}
