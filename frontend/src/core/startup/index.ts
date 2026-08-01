/**
 * Startup flow: the single place that decides where the application goes after
 * the splash screen. Navigation policy lives here rather than in page
 * components, so replacing the onboarding check with backend session validation
 * is a change to one module.
 */
export {
  completeOnboarding,
  createMemoryOnboardingStorage,
  createWebOnboardingStorage,
  getOnboardingStorage,
  resetOnboarding,
  setOnboardingStorage,
  type OnboardingStorage,
} from "./onboarding-storage";
export { resolveStartupRoute, type StartupContext } from "./startup-route";
export { useStartupRoute } from "./use-startup-route";
