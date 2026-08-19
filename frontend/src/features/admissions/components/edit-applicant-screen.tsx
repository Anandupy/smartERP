"use client";

import { useRouter } from "next/navigation";

import { ROUTES } from "@/constants";
import { PageHeader } from "@/shared/components/layout";

import { useUpdateApplicant } from "../hooks/use-applicants";
import {
  toApplicantFormValues,
  toApplicantRequest,
} from "../mappers/applicant.mapper";
import type { ApplicantDto } from "../types/applicant.dto";
import { ApplicantForm, type ApplicantFormProps } from "./applicant-form";

export type EditApplicantScreenProps = Pick<
  ApplicantFormProps,
  | "programPicker"
  | "genderPicker"
  | "religionPicker"
  | "castePicker"
  | "categoryPicker"
  | "motherTonguePicker"
  | "bloodGroupPicker"
  | "disabilityTypePicker"
  | "admissionSourcePicker"
  | "quotaPicker"
> & { applicant: ApplicantDto };

/**
 * Edit an applicant's information.
 *
 * Locked once the application has left `DRAFT` — `admissions-production-audit.md`
 * §2: "the applicant is frozen if they transition out of DRAFT or SUBMITTED.
 * Once in APPROVED status, the record is locked against direct edits." This
 * screen still renders for a non-DRAFT applicant (so a direct link never
 * 404s), but every field is disabled and the reason is stated rather than
 * silently failing on submit.
 */
export function EditApplicantScreen({
  applicant,
  ...pickers
}: EditApplicantScreenProps) {
  const router = useRouter();
  const update = useUpdateApplicant(applicant.id);

  const isEditable = applicant.admissionStatus === "DRAFT";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Application"
        description={applicant.displayName}
      />

      <ApplicantForm
        {...pickers}
        defaultValues={toApplicantFormValues(applicant)}
        submitLabel="Save changes"
        disabled={!isEditable}
        disabledReason={`This application is ${applicant.admissionStatus.toLowerCase().replace(/_/g, " ")}. Only Draft applications can be edited directly.`}
        onCancel={() =>
          router.push(ROUTES.app.admissions.applicants.detail(applicant.id))
        }
        onSubmit={async (values) => {
          await update.mutateAsync(toApplicantRequest(values));
          router.push(ROUTES.app.admissions.applicants.detail(applicant.id));
        }}
      />
    </div>
  );
}
