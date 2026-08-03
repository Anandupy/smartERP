"use client";

import { useRouter } from "next/navigation";

import { ROUTES } from "@/constants";
import { PageHeader } from "@/shared/components/layout";

import { useCreateMaintenanceRule } from "../hooks/use-maintenance-rules";
import { toRuleRequest } from "../mappers/maintenance.mapper";
import { maintenanceRuleFormDefaults } from "../schemas/maintenance-rule.schema";
import { MaintenanceRuleForm } from "./maintenance-rule-form";

/** Create a maintenance rule. */
export function CreateRuleScreen() {
  const router = useRouter();
  const create = useCreateMaintenanceRule();

  return (
    <div className="space-y-6">
      <PageHeader
        title="New maintenance rule"
        description="Choose what the rule covers, what stays reachable while it applies, and when."
      />

      <MaintenanceRuleForm
        defaultValues={maintenanceRuleFormDefaults()}
        submitLabel="Create rule"
        onCancel={() => router.push(ROUTES.app.maintenance.root)}
        onSubmit={async (values) => {
          await create.mutateAsync(toRuleRequest(values));
          router.push(ROUTES.app.maintenance.root);
        }}
      />
    </div>
  );
}
