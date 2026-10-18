import type { Metadata } from "next";

import { FileText, Landmark, SlidersHorizontal } from "@/assets/icons";
import { ROUTES } from "@/constants";
import { LinkCard } from "@/shared/components/data-display";
import { PageHeader } from "@/shared/components/layout";

export const metadata: Metadata = {
  title: "Admissions",
};

/**
 * Admissions hub.
 *
 * Applicants — the operational workspace for the admission lifecycle
 * (`Applicant → Person → Guardian → Documents → Workflow → Student →
 * Admission → Enrollment`) — is the primary destination, per the design
 * brief's own instruction that the Applicant Journey be the module's central
 * workspace rather than the reference-data screens.
 */
export default function AdmissionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Admissions"
        description="Applicant lifecycle and the reference data it draws from."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <LinkCard
          icon={FileText}
          title="Applicants"
          description="Register, review and admit applicants — one workspace for the complete lifecycle."
          href={ROUTES.app.admissions.applicants.directory}
        />
        <LinkCard
          icon={Landmark}
          title="Admission Masters"
          description="Genders, religions, castes, categories, quotas and the other reference data applicant forms draw from."
          href={ROUTES.app.admissionMasters.root}
        />
        <LinkCard
          icon={SlidersHorizontal}
          title="Admission workflow"
          description="Choose how this branch admits students — simple, standard or verified — and which optional steps it uses."
          href={ROUTES.app.admissions.workflow}
        />
      </div>
    </div>
  );
}
