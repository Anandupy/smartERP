/**
 * Public surface of the Academic Year module.
 *
 * Scope: `/academic-years` — the administrative timeframes inside a branch. All
 * eight documented endpoints are wired: create, list, current, update, the
 * three lifecycle transitions, and the documented soft delete.
 *
 * Five contract facts shape the module, and all five are visible in the UI:
 *
 * 1. **There is no `GET /academic-years/:id`.** The collection documents eight
 *    endpoints and a read-by-id is not among them. Rather than invent one, a
 *    single record is resolved out of the documented branch list — which is why
 *    every detail screen needs an active branch, and why "not found" is phrased
 *    as "not in this branch's list".
 * 2. **Everything is branch-scoped.** `branchId` is a documented *required*
 *    parameter on both reads, and no endpoint lists years across branches. The
 *    active branch comes from `useWorkspace()` and nowhere else; without one,
 *    every screen says so instead of rendering an empty list.
 * 3. **The lifecycle is a one-way ratchet.** `activate`, `select` and `lock`
 *    each name a target state, so all three are idempotent and none has to be
 *    withheld the way the branch status toggle does. But the contract documents
 *    **no inverse** — no deactivate, no deselect, no unlock, no restore — so
 *    every confirmation says so and the four missing transitions are listed
 *    explicitly rather than being silently absent.
 * 4. **The three flags are independent booleans**, not one status enum. A year
 *    can be current *and* locked. The badge picks one label by operational
 *    consequence; the detail screen reports all three separately, and an
 *    unreported flag reads "Not reported" rather than "No".
 * 5. **A calendar needs events, and there are none.** `startDate` and `endDate`
 *    are real, so spans, progress and a today marker are computed from data.
 *    Terms, holidays, exam windows and milestones have no field and no
 *    endpoint, so they are enumerated as pending and no empty month grid is
 *    drawn — an empty calendar reads as "nothing is scheduled", which is a
 *    claim this app cannot make.
 */

// Screens
export {
  AcademicYearDashboardScreen,
  type AcademicYearDashboardScreenProps,
} from "./components/academic-year-dashboard-screen";
export { AcademicYearDirectoryScreen } from "./components/academic-year-directory-screen";
export {
  AcademicYearDetailsScreen,
  type AcademicYearDetailsScreenProps,
} from "./components/academic-year-details-screen";
export { CreateAcademicYearScreen } from "./components/create-academic-year-screen";
export {
  EditAcademicYearScreen,
  type EditAcademicYearScreenProps,
} from "./components/edit-academic-year-screen";
export {
  AcademicYearLifecycleScreen,
  type AcademicYearLifecycleScreenProps,
} from "./components/academic-year-lifecycle-screen";
export { AcademicYearCalendarScreen } from "./components/academic-year-calendar-screen";

// Composable pieces
export {
  AcademicYearBoundary,
  type AcademicYearBoundaryProps,
} from "./components/academic-year-boundary";
export {
  AcademicYearForm,
  type AcademicYearFormProps,
} from "./components/academic-year-form";
export {
  AcademicYearsTable,
  type AcademicYearsTableProps,
} from "./components/academic-years-table";
export {
  AcademicYearStatusBadge,
  type AcademicYearStatusBadgeProps,
} from "./components/academic-year-status-badge";
export {
  AcademicYearProgressBar,
  type AcademicYearProgressBarProps,
} from "./components/academic-year-progress";
export {
  AcademicYearTimeline,
  type AcademicYearTimelineProps,
} from "./components/academic-year-timeline-view";
export {
  DeleteAcademicYearDialog,
  TransitionAcademicYearDialog,
  type DeleteAcademicYearDialogProps,
  type TransitionAcademicYearDialogProps,
} from "./components/academic-year-dialogs";

// Backend integration
export { academicYearService } from "./api/academic-year.service";
export { academicYearKeys } from "./api/academic-year.keys";
export {
  filterAcademicYears,
  useAcademicYear,
  useAcademicYearBranch,
  useAcademicYearTransition,
  useAcademicYears,
  useCreateAcademicYear,
  useCurrentAcademicYear,
  useDeleteAcademicYear,
  useUpdateAcademicYear,
  type AcademicYearFilters,
} from "./hooks/use-academic-years";
export {
  formatAcademicYearRange,
  toAcademicYearFormValues,
  toAcademicYearRequest,
  toDateInputValue,
} from "./mappers/academic-year.mapper";
export {
  ACADEMIC_YEAR_LIFECYCLE_STAGES,
  SUPPORTED_ACADEMIC_YEAR_STAGES,
  UNSUPPORTED_ACADEMIC_YEAR_TRANSITIONS,
  availableLifecycleActions,
  deleteBlockedReason,
  editBlockedReason,
  isCurrentAcademicYearStage,
  lifecycleActions,
  type AcademicYearLifecycleStage,
  type LifecycleAction,
} from "./utils/academic-year-lifecycle";
export {
  academicYearProgress,
  buildTimelineLayout,
  type AcademicYearProgress,
  type TimelineBand,
  type TimelineLayout,
  type TimelinePhase,
} from "./utils/academic-year-timeline";

// Guide
export { academicYearsGuide } from "./guide/academic-years.guide";

// Contracts
export {
  ACADEMIC_YEAR_TRANSITIONS,
  type AcademicYearDto,
  type AcademicYearTransition,
  type CreateAcademicYearRequest,
  type UpdateAcademicYearRequest,
} from "./types/academic-year.dto";
export {
  academicYearFormDefaults,
  academicYearFormSchema,
  findOverlappingYear,
  type AcademicYearFormValues,
  type DateRange,
} from "./schemas/academic-year.schema";
export {
  ACADEMIC_YEAR_AUDIT_MODULE,
  ACADEMIC_YEAR_STATE_PRESENTATION,
  ANY_STATE,
  DIRECTORY_PAGE_SIZE,
  FLAG_PRESENTATION,
  STATE_FILTER_OPTIONS,
  academicYearState,
  readFlag,
  type AcademicYearState,
  type FlagState,
} from "./constants";
