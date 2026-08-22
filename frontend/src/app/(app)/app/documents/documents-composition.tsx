"use client";

import { useMemo } from "react";
import { useFormContext } from "react-hook-form";

import { useAdmissionMasterList } from "@/features/admission-masters";
import { ADMISSION_APPLICATION_STATUSES, STATUS_LABEL } from "@/features/admissions";
import {
  CreateDocumentRequirementScreen,
  DocumentRequirementListScreen,
  EditDocumentRequirementScreen,
  OptionalSelectField,
} from "@/features/documents";
import { useProgramBranch, usePrograms } from "@/features/program";

/**
 * Where Documents meets Program and Admission Masters.
 *
 * AGENTS.md §28: *"Two features that meet do so at the route, through slots —
 * never by importing each other."* This mirrors
 * `admissions/applicants/applicant-composition.tsx`: Document Requirements
 * targets a program, quota and category, but the `documents` feature only
 * knows it has three slots to fill — it never imports Program or Admission
 * Masters.
 *
 * The three scope pickers are `OptionalSelectField`s (documents' own generic
 * "select with an 'applies to all' option") fed by Program's and Admission
 * Masters' real list hooks — not `ProgramPicker`/`AdmissionMasterPicker`
 * themselves, since both bind a *required* selection with no "applies to
 * all" affordance, and every other consumer of those two pickers legitimately
 * needs one.
 *
 * `requiredByStage` reuses `AdmissionApplicationStatus` directly (design spec
 * §8), so its option list comes from Admissions' own constants rather than a
 * parallel enum invented here.
 */

const STAGE_OPTIONS = ADMISSION_APPLICATION_STATUSES.map((value) => ({
  value,
  label: STATUS_LABEL[value],
}));

interface ScopeOption {
  value: string;
  label: string;
}

/** Program names by id, plus the option list for both filtering and the picker. */
function useProgramNames(): { names: ReadonlyMap<string, string>; options: ScopeOption[] } {
  const branch = useProgramBranch();
  const { programs } = usePrograms(branch?.id ?? null);

  return useMemo(() => {
    const names = new Map<string, string>();
    const options = programs.map((program) => {
      names.set(program.id, program.name);
      return { value: program.id, label: program.name };
    });
    return { names, options };
  }, [programs]);
}

/** Admission-master names by id, for one master type — for the directory's display columns. */
function useMasterNames(type: "quotas" | "categories"): ReadonlyMap<string, string> {
  const { masters } = useAdmissionMasterList(type);

  return useMemo(() => {
    const names = new Map<string, string>();
    for (const master of masters) names.set(master.id, master.name);
    return names;
  }, [masters]);
}

/**
 * `OptionalSelectField` binds via `useFormContext()` exactly like
 * `ProgramPicker`/`AdmissionMasterPicker` do — this wrapper supplies
 * `control` from context so the hook below can hand back plain `ReactNode`
 * slots without threading a form object across the feature boundary.
 */
function BoundOptionalSelectField({
  name,
  label,
  allLabel,
  options,
}: {
  name: string;
  label: string;
  allLabel: string;
  options: ScopeOption[];
}) {
  const form = useFormContext();
  if (!form) return null;

  return (
    <OptionalSelectField
      control={form.control}
      name={name}
      label={label}
      allLabel={allLabel}
      options={options}
    />
  );
}

/** The three Document Requirement scope pickers, built from real cross-feature data. */
function useRequirementPickers() {
  const { options: programOptions } = useProgramNames();
  const { masters: quotas } = useAdmissionMasterList("quotas");
  const { masters: categories } = useAdmissionMasterList("categories");

  const quotaOptions = quotas
    .filter((quota) => quota.isActive)
    .map((quota) => ({ value: quota.id, label: quota.name }));
  const categoryOptions = categories
    .filter((category) => category.isActive)
    .map((category) => ({ value: category.id, label: category.name }));

  return {
    programPicker: (
      <BoundOptionalSelectField
        name="appliesToProgramId"
        label="Program"
        allLabel="All programs"
        options={programOptions}
      />
    ),
    quotaPicker: (
      <BoundOptionalSelectField
        name="appliesToQuotaId"
        label="Quota"
        allLabel="All quotas"
        options={quotaOptions}
      />
    ),
    categoryPicker: (
      <BoundOptionalSelectField
        name="appliesToCategoryId"
        label="Category"
        allLabel="All categories"
        options={categoryOptions}
      />
    ),
  };
}

/** Document Requirements directory, with real program/quota/category names resolved for display. */
export function DocumentRequirementListRoute() {
  const { names: programNames, options: programOptions } = useProgramNames();
  const quotaNames = useMasterNames("quotas");
  const categoryNames = useMasterNames("categories");

  return (
    <DocumentRequirementListScreen
      programNames={programNames}
      programOptions={programOptions}
      quotaNames={quotaNames}
      categoryNames={categoryNames}
      stageOptions={STAGE_OPTIONS}
    />
  );
}

/** Create a Document Requirement, with the three scope pickers slotted in. */
export function CreateDocumentRequirementRoute() {
  const pickers = useRequirementPickers();

  return <CreateDocumentRequirementScreen {...pickers} stageOptions={STAGE_OPTIONS} />;
}

/** Edit a Document Requirement, with the same three pickers. */
export function EditDocumentRequirementRoute({ id }: { id: string }) {
  const pickers = useRequirementPickers();

  return <EditDocumentRequirementScreen id={id} {...pickers} stageOptions={STAGE_OPTIONS} />;
}
