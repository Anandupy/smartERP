"use client";

import Link from "next/link";
import { useMemo } from "react";

import {
  AcademicUnitPicker,
  academicUnitDisplayPath,
  academicUnitState,
  placementTargetState,
  useAcademicUnitScope,
  useAcademicUnits,
} from "@/features/academic-unit";
import {
  AdmissionMasterPicker,
  useAdmissionMasterList,
} from "@/features/admission-masters";
import {
  ApplicantBoundary,
  ApplicantJourneyHubScreen,
  CreateApplicantScreen,
  EditApplicantScreen,
} from "@/features/admissions";
import { Hash } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants";
import {
  ApplicantDocumentsPanel,
  buildChecklist,
  checklistSummary,
  useDocumentRequirements,
  useOwnerDocuments,
} from "@/features/documents";
import {
  ApplicantGuardiansPanel,
  formatGuardianName,
  useApplicantGuardians,
} from "@/features/guardians";
import { PersonPanel } from "@/features/person";
import { ProgramPicker, useProgramBranch, usePrograms } from "@/features/program";
import { EmptyState } from "@/shared/components/feedback";
import type { ApplicantDto } from "@/features/admissions";

/**
 * Where Admissions meets Admission Masters, Program, Academic Unit,
 * Guardians, Documents and Person.
 *
 * AGENTS.md §28: *"Two features that meet do so at the route, through slots
 * — never by importing each other."* This file is that route composition,
 * mirroring `academic-units/program-composition.tsx`. It is the **only**
 * module that imports all seven feature barrels together. Nothing but
 * opaque `ReactNode` panels/pickers and plain name maps cross the boundary —
 * Admissions never learns that any of the other six exist as modules, only
 * that it has slots to fill.
 */

const MASTER_FIELD_NAMES = {
  genders: "genderId",
  religions: "religionId",
  castes: "casteId",
  categories: "categoryId",
  languages: "motherTongueId",
  "blood-groups": "bloodGroupId",
  disabilities: "disabilityTypeId",
  "admission-sources": "admissionSourceId",
  quotas: "quotaId",
} as const;

/** The nine admission-master pickers an applicant form needs. */
function useApplicantMasterPickers() {
  return {
    genderPicker: (
      <AdmissionMasterPicker
        type="genders"
        name={MASTER_FIELD_NAMES.genders}
        label="Gender"
      />
    ),
    religionPicker: (
      <AdmissionMasterPicker
        type="religions"
        name={MASTER_FIELD_NAMES.religions}
        label="Religion"
      />
    ),
    castePicker: (
      <AdmissionMasterPicker
        type="castes"
        name={MASTER_FIELD_NAMES.castes}
        label="Caste"
      />
    ),
    categoryPicker: (
      <AdmissionMasterPicker
        type="categories"
        name={MASTER_FIELD_NAMES.categories}
        label="Category"
      />
    ),
    motherTonguePicker: (
      <AdmissionMasterPicker
        type="languages"
        name={MASTER_FIELD_NAMES.languages}
        label="Mother tongue"
      />
    ),
    bloodGroupPicker: (
      <AdmissionMasterPicker
        type="blood-groups"
        name={MASTER_FIELD_NAMES["blood-groups"]}
        label="Blood group"
      />
    ),
    disabilityTypePicker: (
      <AdmissionMasterPicker
        type="disabilities"
        name={MASTER_FIELD_NAMES.disabilities}
        label="Disability type"
      />
    ),
    admissionSourcePicker: (
      <AdmissionMasterPicker
        type="admission-sources"
        name={MASTER_FIELD_NAMES["admission-sources"]}
        label="Admission source"
        description="Optional. Where the applicant heard about the institution."
      />
    ),
    quotaPicker: (
      <AdmissionMasterPicker
        type="quotas"
        name={MASTER_FIELD_NAMES.quotas}
        label="Quota"
        description="Optional."
      />
    ),
  };
}

/** Program names by id, for the active branch — same shape as academic-units' version. */
function useProgramNames(): ReadonlyMap<string, string> {
  const branch = useProgramBranch();
  const { programs } = usePrograms(branch?.id ?? null);

  return useMemo(() => {
    const names = new Map<string, string>();
    for (const program of programs) names.set(program.id, program.name);
    return names;
  }, [programs]);
}

/** Relation Type master names by id, for the active branch. */
function useRelationTypeNames(): ReadonlyMap<string, string> {
  const { masters } = useAdmissionMasterList("relation-types");

  return useMemo(() => {
    const names = new Map<string, string>();
    for (const master of masters) names.set(master.id, master.name);
    return names;
  }, [masters]);
}

/** The Relation Type picker, for Guardians' mapping form. */
function RelationTypePicker() {
  return (
    <AdmissionMasterPicker
      type="relation-types"
      name="relationTypeId"
      label="Relation type"
    />
  );
}

/**
 * The Admit dialog's academic-unit slot: the real picker when the
 * applicant's program has at least one *placement-target* academic unit in
 * the active branch and year, otherwise a structured empty state — never a
 * picker silently offering nothing (task: "do not silently allow final
 * admission").
 *
 * Filters the same way `AcademicUnitPicker` does internally (`programId` +
 * active-only + placement-targets-only) so "is there anything to choose"
 * matches what the picker itself would show — this composition owns that
 * decision because the picker is an opaque `ReactNode` once handed to
 * Admissions.
 */
function useAcademicUnitSlot(programId: string) {
  const scope = useAcademicUnitScope();
  const { units, isPending } = useAcademicUnits(scope);

  const available = useMemo(
    () =>
      units.filter(
        (unit) =>
          unit.programId === programId &&
          academicUnitState(unit) !== "inactive" &&
          placementTargetState(unit) === "target",
      ),
    [units, programId],
  );

  if (isPending) {
    return (
      <AcademicUnitPicker
        programId={programId}
        description="Which section the applicant actually joins — not recorded until this moment."
      />
    );
  }

  if (available.length === 0) {
    const hasStructuralOnly = units.some(
      (unit) => unit.programId === programId && academicUnitState(unit) !== "inactive",
    );

    return (
      <EmptyState
        icon={Hash}
        title="No academic placement available"
        description={
          hasStructuralOnly
            ? "This program's academic units are all structural — they have divisions, sections or batches under them, and none is itself a placement target. Add a leaf unit under the existing structure before admitting into this program."
            : "This program currently has no academic units configured for the selected branch and academic year."
        }
        action={
          <Button asChild variant="outline" size="sm">
            <Link href={ROUTES.app.academicUnits.create}>Configure academic units</Link>
          </Button>
        }
      />
    );
  }

  return (
    <AcademicUnitPicker
      programId={programId}
      description="Which section the applicant actually joins — not recorded until this moment."
    />
  );
}

/**
 * Placement display paths by academic-unit id, for one program — plain data
 * (`ReadonlyMap<string, string>`), the same shape `useProgramNames` already
 * hands to Admissions. Backs the post-admit "Placement" row: `admit()`'s
 * response carries no placement id at all, so the Journey Hub resolves the id
 * its own admit form submitted through this map rather than a second read.
 */
function useAcademicUnitDisplayPaths(programId: string): ReadonlyMap<string, string> {
  const scope = useAcademicUnitScope();
  const { units } = useAcademicUnits(scope);

  return useMemo(() => {
    const paths = new Map<string, string>();
    for (const unit of units) {
      if (unit.programId !== programId) continue;
      paths.set(unit.id, academicUnitDisplayPath(unit));
    }
    return paths;
  }, [units, programId]);
}

/** Primary/financial guardian names for the Admit review — derived from data the Guardians tab already fetches. */
function GuardianSummary({ applicantId }: { applicantId: string }) {
  const { mappings, isPending } = useApplicantGuardians(applicantId);

  if (isPending) {
    return <p className="text-muted-foreground text-sm">Loading guardians…</p>;
  }

  if (mappings.length === 0) {
    return <p className="text-muted-foreground text-sm">No guardians mapped yet.</p>;
  }

  const primary = mappings.find((mapping) => mapping.isPrimary);
  const financial = mappings.find((mapping) => mapping.isFinancialGuardian);

  return (
    <div className="space-y-1 text-sm">
      <p>
        <span className="text-muted-foreground">Primary: </span>
        {primary?.guardian ? formatGuardianName(primary.guardian) : "Not set"}
      </p>
      <p>
        <span className="text-muted-foreground">Financial: </span>
        {financial?.guardian ? formatGuardianName(financial.guardian) : "Not set"}
      </p>
      <p className="text-muted-foreground text-xs">
        {mappings.length} guardian{mappings.length === 1 ? "" : "s"} mapped
      </p>
    </div>
  );
}

/** Required-document readiness for the Admit review — the same checklist the Documents tab computes. */
function DocumentsSummary({ applicant }: { applicant: ApplicantDto }) {
  const { requirements, isPending: requirementsPending } = useDocumentRequirements();
  const { documents, isPending: documentsPending } = useOwnerDocuments(
    "APPLICANT",
    applicant.id,
  );

  const summary = useMemo(
    () =>
      checklistSummary(
        buildChecklist(requirements, documents, {
          programId: applicant.programId,
          quotaId: applicant.quotaId,
          categoryId: applicant.categoryId,
        }),
      ),
    [requirements, documents, applicant.programId, applicant.quotaId, applicant.categoryId],
  );

  if (requirementsPending || documentsPending) {
    return <p className="text-muted-foreground text-sm">Loading documents…</p>;
  }

  return (
    <p className="text-sm">
      {summary.verified} of {summary.total} required documents verified
      {summary.isSatisfied ? (
        <span className="text-chart-2 ml-1.5 font-medium">Complete</span>
      ) : null}
    </p>
  );
}

/** Create, with all ten pickers slotted into the form. */
export function CreateApplicantRoute() {
  const masters = useApplicantMasterPickers();

  return (
    <CreateApplicantScreen
      {...masters}
      programPicker={
        <ProgramPicker description="The programme this applicant is applying for." />
      }
    />
  );
}

/** Edit, with the same ten pickers. Resolves the applicant itself. */
export function EditApplicantRoute({ id }: { id: string }) {
  const masters = useApplicantMasterPickers();

  return (
    <ApplicantBoundary id={id}>
      {(applicant) => (
        <EditApplicantScreen
          {...masters}
          applicant={applicant}
          programPicker={
            <ProgramPicker description="The programme applied for." />
          }
        />
      )}
    </ApplicantBoundary>
  );
}

/**
 * The Journey Hub, with the applicant resolved, its program name looked up,
 * the admit dialog's academic-unit picker slotted in — filtered to the
 * applicant's own programme, since `admit()` refuses a unit belonging to
 * another one (`ACADEMIC_UNIT_MISMATCH`) — and the Guardians/Documents
 * panels composed in as opaque workspaces.
 */
export function ApplicantJourneyHubRoute({ id }: { id: string }) {
  const programNames = useProgramNames();
  const relationTypeNames = useRelationTypeNames();

  return (
    <ApplicantBoundary id={id}>
      {(applicant) => (
        <ApplicantJourneyHubInner
          applicant={applicant}
          programName={programNames.get(applicant.programId) ?? null}
          relationTypeNames={relationTypeNames}
        />
      )}
    </ApplicantBoundary>
  );
}

/**
 * Split out from `ApplicantJourneyHubRoute` only so `useAcademicUnitSlot`
 * (a hook) can be called with the applicant's own `programId` — hooks
 * cannot run conditionally inside the boundary's render-prop callback.
 */
function ApplicantJourneyHubInner({
  applicant,
  programName,
  relationTypeNames,
}: {
  applicant: ApplicantDto;
  programName: string | null;
  relationTypeNames: ReadonlyMap<string, string>;
}) {
  const academicUnitSlot = useAcademicUnitSlot(applicant.programId);
  const academicUnitPaths = useAcademicUnitDisplayPaths(applicant.programId);

  return (
    <ApplicantJourneyHubScreen
      applicant={applicant}
      programName={programName}
      academicUnitPicker={academicUnitSlot}
      academicUnitPaths={academicUnitPaths}
      guardiansPanel={
        <ApplicantGuardiansPanel
          applicantId={applicant.id}
          relationTypeNames={relationTypeNames}
          relationTypePicker={<RelationTypePicker />}
        />
      }
      documentsPanel={
        <ApplicantDocumentsPanel
          applicantId={applicant.id}
          programId={applicant.programId}
          quotaId={applicant.quotaId}
          categoryId={applicant.categoryId}
        />
      }
      guardianSummary={<GuardianSummary applicantId={applicant.id} />}
      documentsSummary={<DocumentsSummary applicant={applicant} />}
      renderPersonPanel={(personId, compact) => (
        <PersonPanel personId={personId} compact={compact} />
      )}
    />
  );
}
