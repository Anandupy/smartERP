/**
 * Public surface of the Academic Unit module.
 *
 * Scope: `/academic-units` — the operational structure inside a program:
 * departments, classes, divisions, batches. All eight documented endpoints are
 * wired: create, list, tree, read, update, move, the status toggle, and the
 * documented soft delete.
 *
 * Five contract facts shape the module:
 *
 * 1. **It needs two levels of workspace scope.** `branchId` *and*
 *    `academicYearId` are both documented `(Required)` on the list and tree
 *    endpoints, and every request carries both scope headers. This is the first
 *    module where that is true, so `AcademicUnitScopeGate` says **which half**
 *    of the scope is missing rather than showing one generic message — a branch
 *    with no selected academic year is fixed in a different module than a
 *    missing branch.
 * 2. **`unitType` is picked from the backend's nine-value enum.** The
 *    documentation names six values across two examples and warns against
 *    hardcoding logic for a particular level; the backend has since confirmed
 *    the full set, so the form offers it as a closed list
 *    (`ACADEMIC_UNIT_TYPES`) while the warning still holds — filters are built
 *    from the data, values read back are rendered verbatim, and **nothing in
 *    this module branches on the value**.
 * 3. **`level` is server-computed and never sent.** The documentation is
 *    explicit that it is auto-calculated and maintained across moves, and it
 *    appears in no request body. When the response omits it, the depth shown is
 *    derived from the hierarchy the browser built — and says so.
 * 4. **`move` is the only lifecycle endpoint with a request body.** Across both
 *    academic modules, every other one is a bodyless flip. `move` names its
 *    target parent, so it is idempotent and safe to confirm and fire — and the
 *    picker offers only destinations the documented consistency and tree rules
 *    permit, so it cannot request one the server will refuse.
 * 5. **The tree endpoint is documented by name only**, so nothing depends on
 *    its shape: the hierarchy is built from the flat list with the shared
 *    `buildTree`, and `readAcademicUnitTree` narrows the endpoint defensively.
 *
 * **The Program seam is a slot.** A unit's request body names a `programId`,
 * and a feature may not import another feature — so the route renders Program's
 * `ProgramPicker` and passes it in as an opaque `ReactNode`, and passes program
 * *names* in as plain data. This module never learns that a Program module
 * exists.
 */

// Guide
export { academicUnitsGuide } from "./guide/academic-units.guide";

// Screens
export {
  AcademicUnitDashboardScreen,
  type AcademicUnitDashboardScreenProps,
} from "./components/academic-unit-dashboard-screen";
export {
  AcademicUnitDirectoryScreen,
  type AcademicUnitDirectoryScreenProps,
} from "./components/academic-unit-directory-screen";
export {
  AcademicUnitTreeScreen,
  type AcademicUnitTreeScreenProps,
} from "./components/academic-unit-tree-screen";
export {
  AcademicUnitDetailsScreen,
  type AcademicUnitDetailsScreenProps,
} from "./components/academic-unit-details-screen";
export {
  CreateAcademicUnitScreen,
  type CreateAcademicUnitScreenProps,
} from "./components/create-academic-unit-screen";
export {
  EditAcademicUnitScreen,
  type EditAcademicUnitScreenProps,
} from "./components/edit-academic-unit-screen";

// Composable pieces
export {
  AcademicUnitBoundary,
  type AcademicUnitBoundaryProps,
} from "./components/academic-unit-boundary";
export {
  AcademicUnitScopeGate,
  type AcademicUnitScopeGateProps,
} from "./components/academic-unit-scope-gate";
export {
  AcademicUnitForm,
  type AcademicUnitFormProps,
} from "./components/academic-unit-form";
export {
  AcademicUnitsTable,
  type AcademicUnitsTableProps,
} from "./components/academic-units-table";
export {
  AcademicUnitStatusBadge,
  type AcademicUnitStatusBadgeProps,
} from "./components/academic-unit-status-badge";
export {
  DeleteAcademicUnitDialog,
  MoveAcademicUnitDialog,
  ToggleAcademicUnitStatusDialog,
  type DeleteAcademicUnitDialogProps,
  type MoveAcademicUnitDialogProps,
  type ToggleAcademicUnitStatusDialogProps,
} from "./components/academic-unit-dialogs";
export {
  AcademicUnitPicker,
  academicUnitDisplayPath,
  type AcademicUnitPickerProps,
} from "./components/academic-unit-picker";

// Backend integration
export {
  academicUnitService,
  type AcademicUnitScope,
} from "./api/academic-unit.service";
export { academicUnitKeys } from "./api/academic-unit.keys";
export {
  filterAcademicUnits,
  useAcademicUnit,
  useAcademicUnitScope,
  useAcademicUnitTree,
  useAcademicUnits,
  useCreateAcademicUnit,
  useDeleteAcademicUnit,
  useMoveAcademicUnit,
  useToggleAcademicUnitStatus,
  useUpdateAcademicUnit,
  type AcademicUnitFilters,
} from "./hooks/use-academic-units";
export {
  formatUnitIdentity,
  fromMetadataText,
  toAcademicUnitFormValues,
  toAcademicUnitRequest,
  toMetadataText,
} from "./mappers/academic-unit.mapper";
export {
  academicUnitAccessors,
  buildAcademicUnitTree,
  childrenOf,
  deleteBlockedReason,
  eligibleParents,
  resolveLevel,
} from "./utils/academic-unit-hierarchy";
export {
  readAcademicUnitTree,
  type AcademicUnitTreeReading,
} from "./utils/read-academic-unit-tree";

// Contracts
export {
  ACADEMIC_UNIT_TYPES,
  type AcademicUnitAncestorDto,
  type AcademicUnitDto,
  type AcademicUnitType,
  type CreateAcademicUnitRequest,
  type MoveAcademicUnitRequest,
  type UpdateAcademicUnitRequest,
} from "./types/academic-unit.dto";
export {
  academicUnitFormDefaults,
  academicUnitFormSchema,
  findDuplicateSibling,
  type AcademicUnitFormValues,
  type SiblingIdentity,
} from "./schemas/academic-unit.schema";
export {
  ACADEMIC_UNIT_AUDIT_MODULE,
  ACADEMIC_UNIT_TYPE_OPTIONS,
  ANY_PROGRAM,
  ANY_STATE,
  ANY_TYPE,
  DIRECTORY_PAGE_SIZE,
  NO_PARENT,
  STATE_FILTER_OPTIONS,
  UNIT_STATE_PRESENTATION,
  academicUnitState,
  placementTargetState,
  type AcademicUnitState,
  type PlacementTargetState,
} from "./constants";
