"use client";

import { useRouter } from "next/navigation";

import { ROUTES } from "@/constants";
import { PageHeader } from "@/shared/components/layout";

import { useCreateNumberingConfig } from "../hooks/use-numbering";
import { toCreateNumberingConfigRequest } from "../mappers/numbering.mapper";
import { numberingConfigFormDefaults } from "../schemas/numbering.schema";
import { NumberingConfigForm } from "./numbering-config-form";

/** Create a `NumberingConfig`. */
export function CreateNumberingConfigScreen() {
  const router = useRouter();
  const create = useCreateNumberingConfig();
  const listHref = ROUTES.app.settings.numbering.root;

  return (
    <div className="space-y-6">
      <PageHeader
        title="New sequence"
        description="Configure the format of a new human-facing identifier."
      />

      <NumberingConfigForm
        defaultValues={numberingConfigFormDefaults()}
        submitLabel="Create sequence"
        showActiveToggle={false}
        onCancel={() => router.push(listHref)}
        onSubmit={async (values) => {
          await create.mutateAsync(toCreateNumberingConfigRequest(values));
          router.push(listHref);
        }}
      />
    </div>
  );
}
