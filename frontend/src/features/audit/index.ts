/**
 * Public surface of the Audit Logs module.
 *
 * Scope: the four documented read endpoints under `/audit-logs` — the paginated
 * list, the summary, the timeline and detail-by-id. The API is read-only by
 * design: audit records are written by the backend's event listener, never by a
 * client.
 *
 * The **query** side of this contract is fully documented (pagination, four
 * sort fields, fifteen filters, keyword search) and is fully wired — this
 * module does no client-side filtering. The **response** side is documented
 * only for the record itself; the summary and timeline shapes are not, so both
 * go through the defensive readers in `utils/analytics.ts` and report
 * `Backend Pending` rather than showing an invented zero. Export has no
 * documented endpoint at all.
 *
 * `AuditExplorer` is the reusable unit: System Settings' History screen is the
 * same explorer pinned to the `SYSTEM` module, composed at the route so neither
 * feature imports the other.
 */

// Screens
export { AuditScreen } from "./components/audit-screen";

// Composable pieces
export {
  AuditExplorer,
  type AuditExplorerProps,
} from "./components/audit-explorer";
export {
  AuditLogTable,
  type AuditLogTableProps,
} from "./components/audit-log-table";
export {
  AuditFiltersControls,
  type AuditFiltersControlsProps,
} from "./components/audit-filters";
export {
  AuditSummaryCards,
  type AuditSummaryCardsProps,
} from "./components/audit-summary-cards";
export {
  AuditTimelineChart,
  type AuditTimelineChartProps,
} from "./components/audit-timeline";
export {
  AuditDetailDrawer,
  type AuditDetailDrawerProps,
} from "./components/audit-detail-drawer";
export {
  AuditExportDialog,
  type AuditExportDialogProps,
} from "./components/audit-export-dialog";

// Backend integration
export { auditService } from "./api/audit.service";
export { auditKeys } from "./api/audit.keys";
export {
  useAuditLog,
  useAuditLogs,
  useAuditSummary,
  useAuditTimeline,
} from "./hooks/use-audit-logs";
export {
  auditFilterDefaults,
  countActiveFilters,
  toAuditQuery,
  type AuditFilters,
} from "./utils/query";
export {
  readDistribution,
  readSummary,
  readTimeline,
  type AuditSummary,
  type AuditTimeline,
  type DistributionEntry,
  type TimelinePoint,
} from "./utils/analytics";

// Contracts
export {
  AUDIT_ACTIONS,
  AUDIT_MODULES,
  AUDIT_PAGE_SIZE_DEFAULT,
  AUDIT_PAGE_SIZE_MAX,
  AUDIT_SORT_FIELDS,
  type AuditAction,
  type AuditChange,
  type AuditLogDto,
  type AuditLogQuery,
  type AuditModule,
  type AuditSortField,
} from "./types/audit.dto";
export {
  ACTION_OPTIONS,
  ANY,
  DATE_PRESETS,
  MODULE_OPTIONS,
  SORT_OPTIONS,
  actionTone,
  type DatePreset,
} from "./constants";
