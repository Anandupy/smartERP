"use client";

import { useRouter } from "next/navigation";

import { ROUTES } from "@/constants";
import { PageHeader } from "@/shared/components/layout";

import { admissionMasterConfig, type AdmissionMasterType } from "../config/admission-master-registry";
import { useUpdateAdmissionMaster } from "../hooks/use-admission-masters";
import { toAdmissionMasterFormValues } from "../mappers/admission-master.mapper";
import { AdmissionMasterBoundary } from "./admission-master-boundary";
import { AdmissionMasterForm } from "./admission-master-form";

export interface EditAdmissionMasterScreenProps {
  masterType: AdmissionMasterType;
  id: string;
}

/** Edit a record of one admission master. Prefilled from the loaded record. */
export function EditAdmissionMasterScreen({
  masterType,
  id,
}: EditAdmissionMasterScreenProps) {
  const config = admissionMasterConfig(masterType);
  const router = useRouter();
  const update = useUpdateAdmissionMaster(masterType, id);
  const detailHref = ROUTES.app.admissionMasters.detail(config.resource, id);

  return (
    <AdmissionMasterBoundary masterType={masterType} config={config} id={id}>
      {(master) => (
        <div className="space-y-6">
          <PageHeader
            title={`Edit ${config.singularLabel}`}
            description={master.name}
          />

          <AdmissionMasterForm
            config={config}
            defaultValues={toAdmissionMasterFormValues(master)}
            submitLabel="Save changes"
            onCancel={() => router.push(detailHref)}
            onSubmit={async (values) => {
              await update.mutateAsync({ values, source: master });
              router.push(detailHref);
            }}
          />
        </div>
      )}
    </AdmissionMasterBoundary>
  );
}
