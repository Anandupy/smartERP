"use client";

import { useRouter } from "next/navigation";

import { ROUTES } from "@/constants";
import { useGuide } from "@/core/guides";
import { PageHeader } from "@/shared/components/layout";

import { useCreateNumberingConfig } from "../hooks/use-numbering";
import { toCreateNumberingConfigRequest } from "../mappers/numbering.mapper";
import { numberingConfigFormDefaults } from "../schemas/numbering.schema";
import { NumberingConfigForm } from "./numbering-config-form";

/** Create a `NumberingConfig`. */
export function CreateNumberingConfigScreen() {
  const router = useRouter();
  const create = useCreateNumberingConfig();
  const guide = useGuide("numbering");
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
        submitGuideTarget="numbering-create-submit"
        onCancel={() => router.push(listHref)}
        onSubmit={async (values) => {
          await create.mutateAsync(toCreateNumberingConfigRequest(values));
          router.push(listHref);
          // Last step of the "numbering" guide — there's no detail route to
          // continue to (see the module's own index.ts), so the guide simply
          // completes here rather than chasing a route that doesn't exist.
          guide.completeGuide();
        }}
      />
    </div>
  );
}
