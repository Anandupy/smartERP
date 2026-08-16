/**
 * `PendingSettingsGroup` moved to `@/shared/components/feedback` — it is
 * generic UI plumbing every backend-pending settings screen needs, not branch
 * domain knowledge. Re-exported here so existing imports within this module
 * keep working.
 */
export {
  PendingSettingsGroup,
  type PendingField,
  type PendingSettingsGroupProps,
} from "@/shared/components/feedback";
