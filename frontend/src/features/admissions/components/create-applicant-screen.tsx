"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ROUTES } from "@/constants";
import { PageHeader } from "@/shared/components/layout";

import { useCreateApplicant } from "../hooks/use-applicants";
import { useAdmissionPolicy } from "../hooks/use-workflow-policy";
import { toApplicantRequest } from "../mappers/applicant.mapper";
import type { AdmissionOcrResult } from "../schemas/admission-ocr.schema";
import { applicantFormDefaults } from "../schemas/applicant.schema";
import {
  AdmissionOcrUploader,
  type ResolveOcrMasters,
} from "./admission-ocr-uploader";
import { ApplicantForm, type ApplicantFormProps } from "./applicant-form";

export type CreateApplicantScreenProps = {
  /** Maps scanned labels to master/program ids — see `AdmissionOcrUploader`. */
  resolveOcrMasters?: ResolveOcrMasters;
  /**
   * Adds the parents read off a scanned form as the new applicant's
   * guardians, returning messages for anything it could not add. Supplied by
   * the route composition — Admissions cannot see Guardians (AGENTS.md §28).
   */
  addScannedGuardians?: (
    applicantId: string,
    scan: AdmissionOcrResult,
  ) => Promise<string[]>;
} & Pick<
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
>;

/**
 * New admission — Applicant Information.
 *
 * `POST /admissions/applicants` creates the application already in `DRAFT`,
 * with a server-generated `applicationNo`. On success the applicant's own
 * Journey Hub is the destination, not the directory — the person who just
 * registered an applicant is far more likely to want to look at the
 * application than at the list they came from.
 *
 * Under SIMPLE_ADMISSION the hub opens straight onto the one-step admission
 * (section, review, Admit student), so registering and admitting is one
 * continuous journey. The profile comes from the backend; if it cannot be
 * read, this behaves exactly as the standard process does — a draft is saved
 * and the hub opens — and the backend still decides whether direct admission
 * is allowed.
 *
 * A filled paper form can be scanned first (`AdmissionOcrUploader`), which
 * pre-fills the fields; the clerk still reviews and submits as usual. On
 * save, the scanned parents are added as guardians unless the clerk opted
 * out; a failure there never undoes the saved applicant.
 */
export function CreateApplicantScreen({
  resolveOcrMasters,
  addScannedGuardians,
  ...props
}: CreateApplicantScreenProps) {
  const router = useRouter();
  const [scan, setScan] = useState<AdmissionOcrResult | null>(null);
  const [addGuardians, setAddGuardians] = useState(true);
  const create = useCreateApplicant();
  const { data: policy } = useAdmissionPolicy();
  const isSimple = policy?.workflowProfile === "SIMPLE_ADMISSION";

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Admission"
        description={
          isSimple
            ? "Enter the student's details and programme. Next you will choose the section, review and admit."
            : "Register the applicant's information. Identity, guardians and documents are managed from the application once it exists."
        }
      />

      <ApplicantForm
        {...props}
        header={
          <AdmissionOcrUploader
            resolveMasters={resolveOcrMasters}
            onScanned={setScan}
            addGuardians={
              addScannedGuardians
                ? { checked: addGuardians, onChange: setAddGuardians }
                : undefined
            }
          />
        }
        defaultValues={applicantFormDefaults()}
        submitLabel={isSimple ? "Continue to admission" : "Save draft"}
        onCancel={() => router.push(ROUTES.app.admissions.applicants.directory)}
        onSubmit={async (values) => {
          const created = await create.mutateAsync(toApplicantRequest(values));
          if (scan && addGuardians && addScannedGuardians) {
            try {
              const notices = await addScannedGuardians(created.id, scan);
              for (const notice of notices) toast.warning(notice);
            } catch {
              toast.warning(
                "The applicant was saved, but the parents could not be added as guardians. Add them from the Guardians tab.",
              );
            }
          }
          router.push(
            isSimple
              ? ROUTES.app.admissions.applicants.admit(created.id)
              : ROUTES.app.admissions.applicants.detail(created.id),
          );
        }}
      />
    </div>
  );
}
