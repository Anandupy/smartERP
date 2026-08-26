/**
 * Public surface of the Numbering module.
 *
 * Scope: `NumberingConfig` — the format of every human-facing business
 * identifier the platform generates (`studentCode`, `admissionNo`, and
 * others). Confirmed against `backend/postman/erp.postman_collection.json`'s
 * "Numbering / Config" folder and
 * `backend/docs/planning/00-foundation/03-numbering.md` (design spec,
 * `Status: planned`). See `docs/numbering-module.md` for the full contract.
 *
 * **There is no "generate a number" endpoint, and this module never
 * implements one.** Allocation happens only inside a business operation
 * that is about to persist the result — `admit()` allocates `STUDENT_CODE`
 * and `ADMISSION_NO` internally. This module only configures the format
 * (Create/Edit) and previews it (`Preview` — confirmed to consume no
 * number). No screen here calls Preview and then feeds the result into
 * another request.
 *
 * **No `GET /:id` and no `DELETE` are documented.** A single record for
 * editing is resolved out of the list read; an unwanted sequence is
 * deactivated (`isActive: false`), never removed.
 *
 * Placed under System Settings, not a new top-level navigation module —
 * this is platform configuration, the same category as Maintenance and
 * System Information.
 */

// Screens
export { NumberingConfigListScreen } from "./components/numbering-config-list-screen";
export { CreateNumberingConfigScreen } from "./components/create-numbering-config-screen";
export {
  EditNumberingConfigScreen,
  type EditNumberingConfigScreenProps,
} from "./components/edit-numbering-config-screen";

// Composable pieces
export {
  NumberingConfigForm,
  type NumberingConfigFormProps,
} from "./components/numbering-config-form";
export {
  NumberingConfigsTable,
  type NumberingConfigsTableProps,
} from "./components/numbering-configs-table";
export {
  NumberingPreviewPanel,
  type NumberingPreviewPanelProps,
} from "./components/numbering-preview-panel";
export {
  PreviewNumberingDialog,
  type PreviewNumberingDialogProps,
} from "./components/preview-numbering-dialog";
export {
  NumberingSummaryCards,
  type NumberingSummaryCardsProps,
} from "./components/numbering-summary-cards";
export {
  FormatBreakdown,
  parseFormatSegments,
  type FormatBreakdownProps,
} from "./components/format-breakdown";
export {
  FormatPlaceholderChips,
  type FormatPlaceholderChipsProps,
} from "./components/format-placeholder-chips";
export { FormatExplanation } from "./components/format-explanation";

// Backend integration
export { numberingService } from "./api/numbering.service";
export { numberingKeys } from "./api/numbering.keys";
export {
  useCreateNumberingConfig,
  useNumberingBranch,
  useNumberingConfig,
  useNumberingConfigs,
  usePreviewNumbering,
  useUpdateNumberingConfig,
} from "./hooks/use-numbering";
export {
  toCreateNumberingConfigRequest,
  toNumberingConfigFormValues,
  toUpdateNumberingConfigRequest,
} from "./mappers/numbering.mapper";

// Contracts
export {
  NUMBERING_PURPOSES,
  type CreateNumberingConfigRequest,
  type NumberingAllocationMode,
  type NumberingConfigDto,
  type NumberingPurpose,
  type NumberingResetStrategy,
  type NumberingScope,
  type PreviewNumberingRequest,
  type PreviewNumberingResponse,
  type UpdateNumberingConfigRequest,
} from "./types/numbering.dto";
export {
  numberingConfigFormDefaults,
  numberingConfigFormSchema,
  type NumberingConfigFormValues,
} from "./schemas/numbering.schema";
export {
  ALLOCATION_MODE_LABEL,
  DIRECTORY_PAGE_SIZE,
  FORMAT_PLACEHOLDERS,
  FORMAT_PLACEHOLDER_TOKENS,
  PURPOSE_LABEL,
  RESET_STRATEGY_LABEL,
  SCOPE_LABEL,
  YEAR_FORMAT_EXAMPLE,
  YEAR_FORMAT_LABEL,
  filterNumberingConfigs,
  purposeLabel,
  type FormatPlaceholder,
} from "./constants";
