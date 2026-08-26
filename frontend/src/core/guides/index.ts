/**
 * In-app contextual guide platform.
 *
 * Feature modules author `GuideDefinition`s (see `docs/guides.md`) and the app
 * layer registers them once; nothing here has business logic, and nothing
 * outside this module touches Joyride, the registry, or guide persistence
 * directly.
 */
export { GuideProvider } from "./guide-provider";
export { GuideHelpTrigger, type GuideHelpTriggerProps } from "./help-drawer";
export { registerGuide } from "./registry";
export { useGuide, type UseGuideResult } from "./use-guide";
export type {
  GuideCompletionRecord,
  GuideCondition,
  GuideDefinition,
  GuideEvalContext,
  GuideRunStatus,
  GuideStep,
  GuideStepAdvanceMode,
} from "./types";
