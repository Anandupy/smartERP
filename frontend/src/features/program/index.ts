/**
 * Public surface of the Program module.
 *
 * Scope: `/programs` — the academic classification inside a branch. All seven
 * documented endpoints are wired: create, list, tree, read, update, the status
 * toggle, and the documented soft delete.
 *
 * Four contract facts shape the module:
 *
 * 1. **The docs and Postman disagree about `level`.** It is in both request
 *    bodies and in no part of the module documentation — not even its
 *    uniqueness rule. It is **sent**, because Postman is the request contract,
 *    and typed optional on read, because no data structure promises it back.
 *    Its only recorded value is `SCHOOL`, which is a sample and not a value
 *    set, so the field is free text rather than a dropdown.
 * 2. **The tree endpoint is documented by name only.** `GET /programs/tree` has
 *    no response body, no nesting key and no stated envelope, so nothing
 *    depends on its shape: the hierarchy is built from the flat list with the
 *    shared `buildTree`, and `readProgramTree` narrows the endpoint defensively
 *    so a wrong guess degrades to a marker rather than a broken screen.
 * 3. **The status toggle takes no request body**, so it flips `isActive` rather
 *    than setting it — the same non-idempotent shape the branch toggle has. It
 *    is confirmed before firing, never retried, never optimistic, and withheld
 *    entirely when the current state was not reported.
 * 4. **Two of the four validation rules are enforced by the controls**, which
 *    is the better place for them: the parent picker only offers same-branch
 *    programs (rule 2) and excludes the record and its descendants (rule 3), so
 *    neither can be broken from the UI at all.
 *
 * **`ProgramPicker` is this module's cross-feature seam.** Academic Unit's
 * request body names a `programId`, and a feature may not import another
 * feature — so the picker is exported here, rendered by the *route*, and passed
 * into Academic Unit's form as an opaque slot. It binds itself through
 * `useFormContext()`, so nothing crosses the boundary but a `ReactNode`.
 */

// Screens
export {
  ProgramDashboardScreen,
  type ProgramDashboardScreenProps,
} from "./components/program-dashboard-screen";
export { ProgramDirectoryScreen } from "./components/program-directory-screen";
export { ProgramTreeScreen } from "./components/program-tree-screen";
export {
  ProgramDetailsScreen,
  type ProgramDetailsScreenProps,
} from "./components/program-details-screen";
export { CreateProgramScreen } from "./components/create-program-screen";
export {
  EditProgramScreen,
  type EditProgramScreenProps,
} from "./components/edit-program-screen";

// Composable pieces
export {
  ProgramBoundary,
  type ProgramBoundaryProps,
} from "./components/program-boundary";
export { ProgramForm, type ProgramFormProps } from "./components/program-form";
export {
  ProgramsTable,
  type ProgramsTableProps,
} from "./components/programs-table";
export {
  ProgramStatusBadge,
  type ProgramStatusBadgeProps,
} from "./components/program-status-badge";
export {
  DeleteProgramDialog,
  ToggleProgramStatusDialog,
  type DeleteProgramDialogProps,
  type ToggleProgramStatusDialogProps,
} from "./components/program-dialogs";
/** The cross-feature seam. See the note above. */
export {
  ProgramPicker,
  type ProgramPickerProps,
} from "./components/program-picker";

// Backend integration
export { programService } from "./api/program.service";
export { programKeys } from "./api/program.keys";
export {
  filterPrograms,
  useCreateProgram,
  useDeleteProgram,
  useProgram,
  useProgramBranch,
  useProgramTree,
  usePrograms,
  useToggleProgramStatus,
  useUpdateProgram,
  type ProgramFilters,
} from "./hooks/use-programs";
export {
  formatProgramClassification,
  toProgramFormValues,
  toProgramRequest,
} from "./mappers/program.mapper";
export {
  buildProgramTree,
  childrenOf,
  deleteBlockedReason,
  eligibleParents,
  programAccessors,
} from "./utils/program-hierarchy";
export {
  readProgramTree,
  type ProgramTreeReading,
} from "./utils/read-program-tree";

// Contracts
export type {
  CreateProgramRequest,
  ProgramDto,
  UpdateProgramRequest,
} from "./types/program.dto";
export {
  findDuplicateProgram,
  programFormDefaults,
  programFormSchema,
  type ProgramFormValues,
  type ProgramIdentity,
} from "./schemas/program.schema";
export {
  ANY_LEVEL,
  ANY_STATE,
  DIRECTORY_PAGE_SIZE,
  NO_PARENT,
  PROGRAM_AUDIT_MODULE,
  PROGRAM_STATE_PRESENTATION,
  STATE_FILTER_OPTIONS,
  programState,
  type ProgramState,
} from "./constants";
