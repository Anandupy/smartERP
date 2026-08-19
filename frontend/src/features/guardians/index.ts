/**
 * Public surface of the Guardians module.
 *
 * Scope: `Guardian`, `ApplicantGuardianMapping` and the read-only
 * `Guardianship` surface — sourced from `docs/admission-lifecycle-module.md`
 * §5. Guardian is still branch-scoped (no academic year) and still carries a
 * plaintext `aadhaarNo` today; see `docs/backend-gaps.md` §M (GD1–GD4).
 *
 * **The current contract has no single nested-payload create.** Adding a
 * guardian is find-or-create, then map — three round trips, not one (module
 * doc §5.7). `AddGuardianDialog` is that flow, not a workaround for it.
 *
 * **Cross-feature seam**: the Relation Type master picker (from
 * `features/admission-masters`) and its name lookup are never imported here
 * — every component that needs one takes it as a `ReactNode`/`ReadonlyMap`
 * prop, slotted in by the route composition (AGENTS.md §28). See
 * `applicant-composition.tsx`.
 */

// Screens / panels
export {
  ApplicantGuardiansPanel,
  type ApplicantGuardiansPanelProps,
} from "./components/applicant-guardians-panel";

// Composable pieces
export { AddGuardianDialog, type AddGuardianDialogProps } from "./components/add-guardian-dialog";
export {
  EditGuardianDialog,
  type EditGuardianDialogProps,
} from "./components/edit-guardian-dialog";
export {
  EditGuardianMappingDialog,
  type EditGuardianMappingDialogProps,
} from "./components/edit-guardian-mapping-dialog";
export {
  GuardianForm,
  type GuardianFormProps,
} from "./components/guardian-form";
export {
  GuardianMappingForm,
  type GuardianMappingFormProps,
} from "./components/guardian-mapping-form";
export {
  GuardianMappingCard,
  type GuardianMappingCardProps,
} from "./components/guardian-mapping-card";
export {
  GuardianSearchPanel,
  type GuardianSearchPanelProps,
} from "./components/guardian-search-panel";

// Backend integration
export { guardianService } from "./api/guardian.service";
export { guardianKeys } from "./api/guardian.keys";
export {
  useApplicantGuardians,
  useCreateGuardian,
  useGuardian,
  useGuardianBranch,
  useGuardianSearch,
  useMapGuardianToApplicant,
  useRemoveGuardianMapping,
  useUpdateGuardian,
  useWardGuardianships,
} from "./hooks/use-guardians";
export {
  formatGuardianName,
  toGuardianFormValues,
  toGuardianMappingFormValues,
  toGuardianRequest,
  toMapGuardianRequest,
} from "./mappers/guardian.mapper";

// Contracts
export type {
  ApplicantGuardianMappingDto,
  GuardianDto,
  GuardianRequest,
  GuardianSearchResult,
  GuardianshipDto,
  MapGuardianRequest,
} from "./types/guardian.dto";
export {
  guardianFormDefaults,
  guardianFormSchema,
  guardianMappingFormDefaults,
  guardianMappingFormSchema,
  type GuardianFormValues,
  type GuardianMappingFormValues,
} from "./schemas/guardian.schema";
