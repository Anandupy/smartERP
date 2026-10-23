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
  BulkImportScreen,
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
  guardianService,
  useApplicantGuardians,
} from "@/features/guardians";
import { PersonPanel } from "@/features/person";
import {
  ProgramPicker,
  useProgramBranch,
  usePrograms,
} from "@/features/program";
import { EmptyState } from "@/shared/components/feedback";
import type {
  AdmissionOcrMasterLabels,
  AdmissionOcrResult,
  ApplicantDto,
  ResolveOcrMasters,
} from "@/features/admissions";

import { planScannedGuardians } from "./scanned-guardians";

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
      (unit) =>
        unit.programId === programId && academicUnitState(unit) !== "inactive",
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
            <Link href={ROUTES.app.academicUnits.create}>
              Configure academic units
            </Link>
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
function useAcademicUnitDisplayPaths(
  programId: string,
): ReadonlyMap<string, string> {
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
    return (
      <p className="text-muted-foreground text-sm">No guardians mapped yet.</p>
    );
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
        {financial?.guardian
          ? formatGuardianName(financial.guardian)
          : "Not set"}
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

type Candidate = {
  id: string;
  name: string;
  code?: string | null;
  isActive?: boolean | null;
};

/** The id of the active record whose name or code matches `label`, if exactly one does. */
function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
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
function findByLabel(
  records: readonly Candidate[],
  label: string,
): string | null {
  const key = matchKey(label);
  if (!key) return null;
  const active = records.filter((record) => record.isActive !== false);
  const keys = (record: Candidate) => [
    matchKey(record.name),
    ...(record.code ? [matchKey(record.code)] : []),
  ];

  const exact = active.filter((record) => keys(record).includes(key));
  if (exact.length > 0) return exact.length === 1 ? exact[0].id : exact[0].id;

  const allowed = key.length >= 8 ? 2 : key.length >= 4 ? 1 : 0;
  if (allowed === 0) return null;
  const close = active.filter((record) =>
    keys(record).some((k) => editDistance(k, key) <= allowed),
  );
  return close.length > 0 ? close[0].id : null;
}

const CLASS_ORDINAL_MAP: Record<string, string[]> = {
  "1": ["first", "1st", "class1", "std1", "grade1", "primary"],
  "2": ["second", "2nd", "class2", "std2", "grade2", "primary"],
  "3": ["third", "3rd", "class3", "std3", "grade3", "primary"],
  "4": ["fourth", "4th", "class4", "std4", "grade4", "primary"],
  "5": ["fifth", "5th", "class5", "std5", "grade5", "primary"],
  "6": ["sixth", "6th", "class6", "std6", "grade6", "secondary"],
  "7": ["seventh", "7th", "class7", "std7", "grade7", "secondary"],
  "8": ["eighth", "8th", "class8", "std8", "grade8", "secondary"],
  "9": ["ninth", "9th", "class9", "std9", "grade9", "secondary"],
  "10": [
    "tenth",
    "10th",
    "class10",
    "std10",
    "grade10",
    "secondaryschoolcertificate",
    "ssc",
    "secondary",
  ],
  jrkg: ["juniorkg", "junior", "preprimary", "kg1", "lkg"],
  srkg: ["seniorkg", "senior", "preprimary", "kg2", "ukg"],
};

function normalizeBloodGroupKey(value: string): string {
  return value
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/POSITIVE|POS|\+VE/g, "+")
    .replace(/NEGATIVE|NEG|-VE/g, "-")
    .replace(/[^A-Z0-9+-]/g, "");
}

/**
 * A resolved master id, and whether it came from the form (`false`) or is
 * the fallback default used when the scanned label matched nothing (`true`)
 * — defaulted values are filled in but listed for the clerk to check.
 */
type Resolution = { id: string; defaulted: boolean } | null;

function resolveProgramId(
  programs: readonly Candidate[],
  rawLabel: string,
): Resolution {
  const active = programs.filter((p) => p.isActive !== false);
  if (active.length === 0) return null;

  if (rawLabel.trim()) {
    const directId = findByLabel(active, rawLabel);
    if (directId) return { id: directId, defaulted: false };

    const clean = rawLabel.toLowerCase().trim();
    const matchNum = clean.match(/\b(10|[1-9])\b/);
    if (matchNum) {
      const num = matchNum[1];
      const aliases = CLASS_ORDINAL_MAP[num] ?? [];
      const matched = active.find((p) => {
        const pKey = matchKey(p.name);
        // Whole words only: "second" (class 2) must not match "Secondary School Certificate".
        const words = p.name
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter(Boolean);
        return (
          aliases.includes(pKey) ||
          aliases.some((a) => words.includes(a)) ||
          pKey === num
        );
      });
      if (matched) return { id: matched.id, defaulted: false };
    }

    if (/jr|junior|lkg/i.test(clean)) {
      const matched = active.find((p) => /junior|jr/i.test(p.name));
      if (matched) return { id: matched.id, defaulted: false };
    }
    if (/sr|senior|ukg/i.test(clean)) {
      const matched = active.find((p) => /senior|sr/i.test(p.name));
      if (matched) return { id: matched.id, defaulted: false };
    }
    if (/primary/i.test(clean)) {
      const matched = active.find((p) => /primary/i.test(p.name));
      if (matched) return { id: matched.id, defaulted: false };
    }
    if (/secondary|ssc/i.test(clean)) {
      const matched = active.find((p) => /secondary/i.test(p.name));
      if (matched) return { id: matched.id, defaulted: false };
    }
  }

  // Fallback: Secondary School Certificate (SSC) or first active program
  const ssc = active.find((p) => /secondary school/i.test(p.name)) ?? active[0];
  return ssc ? { id: ssc.id, defaulted: true } : null;
}

function resolveCasteId(
  castes: readonly Candidate[],
  rawLabel: string,
): Resolution {
  const active = castes.filter((c) => c.isActive !== false);
  if (active.length === 0) return null;

  if (rawLabel.trim()) {
    const directId = findByLabel(active, rawLabel);
    if (directId) return { id: directId, defaulted: false };

    const tokens = rawLabel
      .split(/[/,;()\-&]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    for (const token of tokens) {
      const tokenId = findByLabel(active, token);
      if (tokenId) return { id: tokenId, defaulted: false };
    }

    const clean = rawLabel.toLowerCase();
    const subMatch = active.find((c) => {
      const cName = c.name.toLowerCase();
      return clean.includes(cName) || cName.includes(clean);
    });
    if (subMatch) return { id: subMatch.id, defaulted: false };
  }

  const fallback =
    active.find((c) => /general|open/i.test(c.name)) ?? active[0];
  return fallback ? { id: fallback.id, defaulted: true } : null;
}

function resolveBloodGroupId(
  bloodGroups: readonly Candidate[],
  rawLabel: string,
): Resolution {
  const active = bloodGroups.filter((b) => b.isActive !== false);
  if (active.length === 0) return null;

  if (rawLabel.trim()) {
    const normalized = normalizeBloodGroupKey(rawLabel);
    const exact = active.find((b) => {
      const bKey = normalizeBloodGroupKey(b.name);
      const bCode = b.code ? normalizeBloodGroupKey(b.code) : "";
      return bKey === normalized || bCode === normalized;
    });
    if (exact) return { id: exact.id, defaulted: false };

    const directId = findByLabel(active, rawLabel);
    if (directId) return { id: directId, defaulted: false };
  }

  const fallback =
    active.find((b) => normalizeBloodGroupKey(b.name) === "O+") ?? active[0];
  return fallback ? { id: fallback.id, defaulted: true } : null;
}

function resolveGenderId(
  genders: readonly Candidate[],
  rawLabel: string,
): Resolution {
  const active = genders.filter((g) => g.isActive !== false);
  if (active.length === 0) return null;

  if (rawLabel.trim()) {
    const directId = findByLabel(active, rawLabel);
    if (directId) return { id: directId, defaulted: false };

    const clean = rawLabel.toLowerCase();
    if (/fem|girl|woman|f\b/i.test(clean)) {
      const female = active.find((g) => /female/i.test(g.name));
      if (female) return { id: female.id, defaulted: false };
    }
    if (/male|boy|man|m\b/i.test(clean)) {
      const male = active.find((g) => /male/i.test(g.name));
      if (male) return { id: male.id, defaulted: false };
    }
  }

  return active[0] ? { id: active[0].id, defaulted: true } : null;
}

function resolveReligionId(
  religions: readonly Candidate[],
  rawLabel: string,
): Resolution {
  const active = religions.filter((r) => r.isActive !== false);
  if (active.length === 0) return null;

  if (rawLabel.trim()) {
    const directId = findByLabel(active, rawLabel);
    if (directId) return { id: directId, defaulted: false };

    const clean = rawLabel.toLowerCase();
    const subMatch = active.find((r) => clean.includes(r.name.toLowerCase()));
    if (subMatch) return { id: subMatch.id, defaulted: false };
  }

  const fallback = active.find((r) => /hindu/i.test(r.name)) ?? active[0];
  return fallback ? { id: fallback.id, defaulted: true } : null;
}

function resolveCategoryId(
  categories: readonly Candidate[],
  rawLabel: string,
): Resolution {
  const active = categories.filter((c) => c.isActive !== false);
  if (active.length === 0) return null;

  if (rawLabel.trim()) {
    const directId = findByLabel(active, rawLabel);
    if (directId) return { id: directId, defaulted: false };

    const clean = rawLabel.toLowerCase();
    const subMatch = active.find(
      (c) =>
        clean.includes(c.name.toLowerCase()) ||
        (c.code && clean.includes(c.code.toLowerCase())),
    );
    if (subMatch) return { id: subMatch.id, defaulted: false };
  }

  const fallback = active.find((c) => /general/i.test(c.name)) ?? active[0];
  return fallback ? { id: fallback.id, defaulted: true } : null;
}

function resolveMotherTongueId(
  languages: readonly Candidate[],
  rawLabel: string,
): Resolution {
  const active = languages.filter((l) => l.isActive !== false);
  if (active.length === 0) return null;

  if (rawLabel.trim()) {
    const directId = findByLabel(active, rawLabel);
    if (directId) return { id: directId, defaulted: false };

    const clean = rawLabel.toLowerCase();
    const subMatch = active.find((l) => clean.includes(l.name.toLowerCase()));
    if (subMatch) return { id: subMatch.id, defaulted: false };
  }

  const fallback =
    active.find((l) => /marathi|hindi|english/i.test(l.name)) ?? active[0];
  return fallback ? { id: fallback.id, defaulted: true } : null;
}

/**
 * Resolves labels read off a scanned paper form ("Female", "OBC", "Std 1") to
 * this branch's admission-master and program ids with smart auto-mapping.
 * The clerk doesn't have to manually select fields — everything auto-populates.
 * Where a label matched nothing, a sensible default is filled in and listed
 * in `defaulted`, so the clerk (and the bulk review queue) knows to check it.
 */
function useOcrMasterResolver(): ResolveOcrMasters {
  const genders = useAdmissionMasterList("genders").masters;
  const religions = useAdmissionMasterList("religions").masters;
  const castes = useAdmissionMasterList("castes").masters;
  const categories = useAdmissionMasterList("categories").masters;
  const languages = useAdmissionMasterList("languages").masters;
  const bloodGroups = useAdmissionMasterList("blood-groups").masters;
  const disabilities = useAdmissionMasterList("disabilities").masters;
  const sources = useAdmissionMasterList("admission-sources").masters;
  const branch = useProgramBranch();
  const { programs } = usePrograms(branch?.id ?? null);

  return useCallback(
    (labels: AdmissionOcrMasterLabels) => {
      const values: Record<string, string> = {};
      const unmatched: string[] = [];
      const defaulted: string[] = [];
      const nameOf = (records: readonly Candidate[], id: string) =>
        records.find((record) => record.id === id)?.name ?? "a default";

      /** Fills a field; a fallback default is filled too, but listed for the clerk. */
      const apply = (
        field: string,
        title: string,
        label: string,
        records: readonly Candidate[],
        resolution: Resolution,
      ) => {
        if (!resolution) return;
        values[field] = resolution.id;
        if (resolution.defaulted) {
          const read = label.trim()
            ? `"${label.trim()}" not found`
            : "not read";
          defaulted.push(
            `${title} (${read}) — set to ${nameOf(records, resolution.id)}`,
          );
        }
      };

      apply(
        MASTER_FIELD_NAMES.genders,
        "Gender",
        labels.gender,
        genders,
        resolveGenderId(genders, labels.gender),
      );
      apply(
        MASTER_FIELD_NAMES.religions,
        "Religion",
        labels.religion,
        religions,
        resolveReligionId(religions, labels.religion),
      );
      apply(
        MASTER_FIELD_NAMES.castes,
        "Caste",
        labels.caste,
        castes,
        resolveCasteId(castes, labels.caste),
      );
      apply(
        MASTER_FIELD_NAMES.categories,
        "Category",
        labels.category,
        categories,
        resolveCategoryId(categories, labels.category),
      );
      apply(
        MASTER_FIELD_NAMES.languages,
        "Mother tongue",
        labels.motherTongue,
        languages,
        resolveMotherTongueId(languages, labels.motherTongue),
      );
      apply(
        MASTER_FIELD_NAMES["blood-groups"],
        "Blood group",
        labels.bloodGroup,
        bloodGroups,
        resolveBloodGroupId(bloodGroups, labels.bloodGroup),
      );
      apply(
        "programId",
        "Programme",
        labels.classAppliedFor,
        programs,
        resolveProgramId(programs, labels.classAppliedFor),
      );

      // Disability type: only when the form names one.
      if (labels.disabilityType?.trim()) {
        const disId = findByLabel(disabilities, labels.disabilityType);
        if (disId) values[MASTER_FIELD_NAMES.disabilities] = disId;
        else
          unmatched.push(`Disability type "${labels.disabilityType.trim()}"`);
      }

      // Admission source: the ticked option, else Walk-in as the default.
      const activeSources = sources.filter((s) => s.isActive !== false);
      const sourceLabel = labels.admissionSource ?? "";
      const SOURCE_HINTS: [RegExp, RegExp][] = [
        [/walk|direct/i, /walk|direct/i],
        [/website|web/i, /website|web/i],
        [/parent|reference|referral/i, /parent|ref/i],
        [/social|media/i, /social|media/i],
      ];
      const hinted = SOURCE_HINTS.find(([read]) => read.test(sourceLabel));
      const sourceMatch =
        (sourceLabel.trim() && findByLabel(activeSources, sourceLabel)) ||
        (hinted && activeSources.find((s) => hinted[1].test(s.name))?.id) ||
        null;
      const walkIn =
        activeSources.find(
          (s) => s.code === "WALKIN" || /direct|walk/i.test(s.name),
        ) ?? activeSources[0];
      apply(
        MASTER_FIELD_NAMES["admission-sources"],
        "Admission source",
        sourceLabel,
        activeSources,
        sourceMatch
          ? { id: sourceMatch, defaulted: false }
          : walkIn
            ? { id: walkIn.id, defaulted: true }
            : null,
      );

      return { values, unmatched, defaulted };
    },
    [
      genders,
      religions,
      castes,
      categories,
      languages,
      bloodGroups,
      disabilities,
      sources,
      programs,
    ],
  );
}

/**
 * Adds the parents read off a scanned form as the new applicant's guardians:
 * an existing guardian with the same mobile and first name (a sibling's
 * parent, say) is reused, otherwise one is created; each is then linked with
 * the branch's Father / Mother relation type. Returns messages for anything
 * that could not be added — never throws for one parent failing.
 */
function useAddScannedGuardians() {
  const { masters: relationTypes } = useAdmissionMasterList("relation-types");

  return useCallback(
    async (
      applicantId: string,
      scan: AdmissionOcrResult,
    ): Promise<string[]> => {
      const { guardians, skipped } = planScannedGuardians(scan);
      const notices = skipped.map(
        (parent) => `Not added as a guardian: ${parent}.`,
      );

      for (const { role, request, mapping } of guardians) {
        const label = `${role} ${request.firstName} ${request.lastName}`;
        const relationTypeId = findByLabel(relationTypes, role);
        if (!relationTypeId) {
          notices.push(
            `${label} was not added: this branch has no "${role}" relation type. Add it under Admission Masters.`,
          );
          continue;
        }
        try {
          const existing = (
            await guardianService.search(request.mobilePrimary)
          ).find(
            (guardian) =>
              guardian.mobilePrimary === request.mobilePrimary &&
              guardian.firstName.toLowerCase() ===
                request.firstName.toLowerCase(),
          );
          const guardian = existing ?? (await guardianService.create(request));
          await guardianService.mapToApplicant(applicantId, {
            guardianId: guardian.id,
            relationTypeId,
            ...mapping,
          });
        } catch {
          notices.push(
            `${label} could not be added as a guardian. Add them from the Guardians tab.`,
          );
        }
      }
      return notices;
    },
    [relationTypes],
  );
}

/** Create, with all ten pickers slotted into the form. */
export function CreateApplicantRoute() {
  const masters = useApplicantMasterPickers();
  const resolveOcrMasters = useOcrMasterResolver();
  const addScannedGuardians = useAddScannedGuardians();

  return (
    <CreateApplicantScreen
      {...masters}
      resolveOcrMasters={resolveOcrMasters}
      addScannedGuardians={addScannedGuardians}
      programPicker={
        <ProgramPicker description="The programme this applicant is applying for." />
      }
    />
  );
}

/** Bulk entry from one PDF of many forms — same pickers, resolver and guardians as Create. */
export function BulkImportRoute() {
  const masters = useApplicantMasterPickers();
  const resolveOcrMasters = useOcrMasterResolver();
  const addScannedGuardians = useAddScannedGuardians();

  return (
    <BulkImportScreen
      {...masters}
      resolveOcrMasters={resolveOcrMasters}
      addScannedGuardians={addScannedGuardians}
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
