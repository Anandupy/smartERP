"use client";

import { useMemo } from "react";

import { AcademicUnitPicker } from "@/features/academic-unit";
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
import { ApplicantDocumentsPanel } from "@/features/documents";
import { ApplicantGuardiansPanel } from "@/features/guardians";
import { ProgramPicker, useProgramBranch, usePrograms } from "@/features/program";

/**
 * Where Admissions meets Admission Masters, Program, Academic Unit,
 * Guardians and Documents.
 *
 * AGENTS.md §28: *"Two features that meet do so at the route, through slots
 * — never by importing each other."* This file is that route composition,
 * mirroring `academic-units/program-composition.tsx`. It is the **only**
 * module that imports all six feature barrels together. Nothing but opaque
 * `ReactNode` panels/pickers and plain name maps cross the boundary —
 * Admissions never learns that any of the other five exist as modules, only
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
        <ApplicantJourneyHubScreen
          applicant={applicant}
          programName={programNames.get(applicant.programId) ?? null}
          academicUnitPicker={
            <AcademicUnitPicker
              programId={applicant.programId}
              description="Which section the applicant actually joins — not recorded until this moment."
            />
          }
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
        />
      )}
    </ApplicantBoundary>
  );
}
