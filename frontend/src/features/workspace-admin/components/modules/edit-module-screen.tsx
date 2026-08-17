"use client";

import { useRouter } from "next/navigation";

import { ROUTES } from "@/constants";
import { usePermissions } from "@/core/auth";
import { ForbiddenState } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";

import { useUpdateModule } from "../../hooks/use-modules";
import { toModuleFormValues, toModuleRequest } from "../../mappers/module.mapper";
import { ModuleBoundary } from "./module-boundary";
import { ModuleForm } from "./module-form";

export interface EditModuleScreenProps {
  id: string;
}

function EditForm({ id }: { id: string }) {
  const router = useRouter();
  const update = useUpdateModule(id);

  return (
    <ModuleBoundary id={id}>
      {(module) => (
        <div className="space-y-6">
          <PageHeader
            title={`Edit ${module.name}`}
            description="Changes take effect as soon as they are saved."
          />

          <ModuleForm
            defaultValues={toModuleFormValues(module)}
            submitLabel="Save changes"
            lockCode={module.isSystem}
            onCancel={() =>
              router.push(ROUTES.app.workspaceAdmin.modules.detail(module.id))
            }
            onSubmit={async (values) => {
              await update.mutateAsync(toModuleRequest(values));
              router.push(ROUTES.app.workspaceAdmin.modules.detail(module.id));
            }}
          />
        </div>
      )}
    </ModuleBoundary>
  );
}

/** Edit an existing module. The form mounts only once the record has loaded. */
export function EditModuleScreen({ id }: EditModuleScreenProps) {
  const { hasRole } = usePermissions();

  if (!hasRole("SUPER_ADMIN")) {
    return (
      <ForbiddenState description="Navigation administration is Super Admin only." />
    );
  }

  return <EditForm id={id} />;
}
