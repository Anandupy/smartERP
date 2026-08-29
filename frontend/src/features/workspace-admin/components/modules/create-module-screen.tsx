"use client";

import { useRouter } from "next/navigation";

import { ROUTES } from "@/constants";
import { usePermissions } from "@/core/auth";
import { useGuide } from "@/core/guides";
import { ForbiddenState } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";

import { useCreateModule } from "../../hooks/use-modules";
import { toModuleRequest } from "../../mappers/module.mapper";
import { moduleFormDefaults } from "../../schemas/module.schema";
import { ModuleForm } from "./module-form";

/** Create a module. On success, its detail screen is the destination. */
export function CreateModuleScreen() {
  const router = useRouter();
  const { hasRole } = usePermissions();
  const create = useCreateModule();
  const guide = useGuide("workspace-modules");

  if (!hasRole("SUPER_ADMIN")) {
    return (
      <ForbiddenState description="Navigation administration is Super Admin only." />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Module"
        description="A new top-level ERP capability. Menus are added to it afterwards."
      />

      <ModuleForm
        defaultValues={moduleFormDefaults()}
        submitLabel="Create module"
        submitGuideTarget="workspace-modules-create-submit"
        onCancel={() => router.push(ROUTES.app.workspaceAdmin.modules.root)}
        onSubmit={async (values) => {
          const created = await create.mutateAsync(toModuleRequest(values));
          router.push(ROUTES.app.workspaceAdmin.modules.detail(created.id));
          guide.reportEvent({ entityId: created.id });
        }}
      />
    </div>
  );
}
