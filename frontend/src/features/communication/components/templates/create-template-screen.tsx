"use client";

import { useRouter } from "next/navigation";

import { ROUTES } from "@/constants";
import { PageHeader } from "@/shared/components/layout";

import { useCommunicationScope } from "../../hooks/use-communication-scope";
import { useCreateTemplate } from "../../hooks/use-templates";
import { toTemplateRequest } from "../../mappers/template.mapper";
import { templateFormDefaults } from "../../schemas/template.schema";
import { CommunicationNoScopeState } from "../communication-scope-gate";
import { TemplateForm } from "./template-form";

/**
 * Create Template — `POST /communication/templates`.
 *
 * Scope (`organizationId`/`branchId`) and `version` (always `1` for a new
 * template) come from this screen, not the form: the module doc says new
 * writes take the active workspace's scope rather than asking for ids, and
 * version is a mutation concern.
 */
export function CreateTemplateScreen() {
  const router = useRouter();
  const scope = useCommunicationScope();
  const create = useCreateTemplate();

  if (!scope) {
    return (
      <div className="space-y-6">
        <PageHeader title="New Template" />
        <CommunicationNoScopeState />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Template"
        description="A message template for one channel, in one language."
      />

      <TemplateForm
        defaultValues={templateFormDefaults()}
        submitLabel="Create template"
        isSubmitting={create.isPending}
        onCancel={() => router.push(ROUTES.app.communication.templates.root)}
        onSubmit={async (values) => {
          const template = await create.mutateAsync(
            toTemplateRequest(values, {
              version: 1,
              organizationId: scope.organizationId,
              branchId: scope.branchId,
            }),
          );
          router.push(
            template?.id
              ? ROUTES.app.communication.templates.detail(template.id)
              : ROUTES.app.communication.templates.root,
          );
        }}
      />
    </div>
  );
}
