"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";

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
  applicantKeys,
  CreateApplicantScreen,
  EditApplicantScreen,
  useApplicantChecklist,
} from "@/features/admissions";
import { Hash } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants";
import {
  ApplicantDocumentsPanel,
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
import type {
  AdmissionOcrMasterLabels,
  ApplicantDto,
  ResolveOcrMasters,
} from "@/features/admissions";

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

/**
 * Required-document readiness for the Admit review — from the backend's
 * checklist, the same answer the admission guards act on.
 */
function DocumentsSummary({
  checklist,
  isPending,
}: {
  checklist: ReturnType<typeof useApplicantChecklist>["data"];
  isPending: boolean;
}) {
  if (isPending || !checklist) {
    return <p className="text-muted-foreground text-sm">Loading documents…</p>;
  }

  const mandatory = checklist.items.filter((item) => item.isMandatory);
  const verified = mandatory.filter((item) => item.satisfied).length;

  if (mandatory.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No documents are required for this application.
      </p>
    );
  }

  return (
    <p className="text-sm">
      {verified} of {mandatory.length} required documents verified
      {checklist.outstandingMandatory === 0 ? (
        <span className="text-chart-2 ml-1.5 font-medium">Complete</span>
      ) : null}
    </p>
  );
}

/** Case/punctuation-insensitive key; class names lose "Std"/"Class" and ordinals ("1st" → "1"). */
function matchKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(std|standard|class|grade)\b\.?/g, " ")
    .replace(/(\d+)(st|nd|rd|th)\b/g, "$1")
    .replace(/[^a-z0-9+-]/g, "");
}

type Candidate = { id: string; name: string; code?: string | null; isActive?: boolean | null };

/** The id of the active record whose name or code matches `label`, if exactly one does. */
function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return row[b.length];
}

/**
 * The id of the active record whose name or code matches `label`. An exact
 * match wins; otherwise a scanned label may differ by an OCR slip ("Enqlish",
 * "Junior K6") — 1 character, or 2 for long names — provided exactly one
 * record is that close.
 */
function findByLabel(records: readonly Candidate[], label: string): string | null {
  const key = matchKey(label);
  if (!key) return null;
  const active = records.filter((record) => record.isActive !== false);
  const keys = (record: Candidate) => [matchKey(record.name), ...(record.code ? [matchKey(record.code)] : [])];

  const exact = active.filter((record) => keys(record).includes(key));
  if (exact.length > 0) return exact.length === 1 ? exact[0].id : null;

  const allowed = key.length >= 8 ? 2 : key.length >= 4 ? 1 : 0;
  if (allowed === 0) return null;
  const close = active.filter((record) => keys(record).some((k) => editDistance(k, key) <= allowed));
  return close.length === 1 ? close[0].id : null;
}

/**
 * Resolves labels read off a scanned paper form ("Female", "OBC", "Std 1") to
 * this branch's admission-master and program ids. A label that matches no
 * record — or more than one — is reported back so the clerk picks it by hand.
 */
function useOcrMasterResolver(): ResolveOcrMasters {
  const genders = useAdmissionMasterList("genders").masters;
  const religions = useAdmissionMasterList("religions").masters;
  const castes = useAdmissionMasterList("castes").masters;
  const categories = useAdmissionMasterList("categories").masters;
  const languages = useAdmissionMasterList("languages").masters;
  const bloodGroups = useAdmissionMasterList("blood-groups").masters;
  const disabilities = useAdmissionMasterList("disabilities").masters;
  const branch = useProgramBranch();
  const { programs } = usePrograms(branch?.id ?? null);

  return useCallback(
    (labels: AdmissionOcrMasterLabels) => {
      const lookups: [keyof AdmissionOcrMasterLabels, string, string, readonly Candidate[]][] = [
        ["gender", MASTER_FIELD_NAMES.genders, "Gender", genders],
        ["religion", MASTER_FIELD_NAMES.religions, "Religion", religions],
        ["caste", MASTER_FIELD_NAMES.castes, "Caste", castes],
        ["category", MASTER_FIELD_NAMES.categories, "Category", categories],
        ["motherTongue", MASTER_FIELD_NAMES.languages, "Mother tongue", languages],
        ["bloodGroup", MASTER_FIELD_NAMES["blood-groups"], "Blood group", bloodGroups],
        ["disabilityType", MASTER_FIELD_NAMES.disabilities, "Disability type", disabilities],
        ["classAppliedFor", "programId", "Programme", programs],
      ];

      const values: Record<string, string> = {};
      const unmatched: string[] = [];
      for (const [labelKey, field, title, records] of lookups) {
        const label = labels[labelKey].trim();
        if (!label) continue;
        const id = findByLabel(records, label);
        if (id) values[field] = id;
        else unmatched.push(`${title} "${label}"`);
      }
      return { values, unmatched };
    },
    [genders, religions, castes, categories, languages, bloodGroups, disabilities, programs],
  );
}

/** Create, with all ten pickers slotted into the form. */
export function CreateApplicantRoute() {
  const masters = useApplicantMasterPickers();
  const resolveOcrMasters = useOcrMasterResolver();

  return (
    <CreateApplicantScreen
      {...masters}
      resolveOcrMasters={resolveOcrMasters}
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
  const checklist = useApplicantChecklist(applicant.id);
  const autoOpenDirectAdmission = useSearchParams().get("next") === "admit";
  useRefreshWorkflowOnDocumentChange(applicant.id);

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
          checklist={checklist.data?.items}
          checklistPending={checklist.isPending}
          checklistError={checklist.error}
          onRetryChecklist={() => void checklist.refetch()}
        />
      }
      guardianSummary={<GuardianSummary applicantId={applicant.id} />}
      documentsSummary={
        <DocumentsSummary
          checklist={checklist.data}
          isPending={checklist.isPending}
        />
      }
      autoOpenDirectAdmission={autoOpenDirectAdmission}
      renderPersonPanel={(personId, compact) => (
        <PersonPanel personId={personId} compact={compact} />
      )}
    />
  );
}

/**
 * Uploading, verifying or rejecting a document changes what the checklist
 * and the workflow guards answer. Documents cannot know Admissions' cache
 * keys (features are isolated), so the join point — this route — refreshes
 * them whenever the applicant's own documents are re-read.
 */
function useRefreshWorkflowOnDocumentChange(applicantId: string) {
  const queryClient = useQueryClient();
  const { dataUpdatedAt } = useOwnerDocuments("APPLICANT", applicantId);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    void queryClient.invalidateQueries({
      queryKey: applicantKeys.checklist(applicantId),
    });
    void queryClient.invalidateQueries({
      queryKey: applicantKeys.workflowActions(applicantId),
    });
  }, [dataUpdatedAt, applicantId, queryClient]);
}
