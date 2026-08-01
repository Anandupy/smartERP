/**
 * Public surface of the auth feature. Outside code (routes, other platform
 * wiring) imports ONLY from here — never from a file inside the module.
 *
 * This phase ships the three entry screens (splash, welcome, login) as UI. The
 * credential mutation, session hand-off, and the recovery screens
 * (forgot-password, OTP, reset, session-expired, account-locked) land in later
 * phases and slot into the seams documented in `docs/authentication.md`.
 */
export {
  SplashScreen,
  type SplashScreenProps,
} from "./components/splash-screen";
export { WelcomeScreen } from "./components/welcome-screen";
export { LoginScreen } from "./components/login-screen";
export { LoginForm, type LoginFormProps } from "./components/login-form";
export { BrandMark, type BrandMarkProps } from "./components/brand-mark";
export { AuthFooter, type AuthFooterProps } from "./components/auth-footer";
export {
  useBootSequence,
  type BootSequenceState,
  type UseBootSequenceOptions,
} from "./hooks/use-boot-sequence";
export {
  loginFormDefaults,
  loginFormSchema,
  type LoginFormValues,
} from "./schemas/login.schema";
export {
  AUTH_TRUST_BADGES,
  LOGIN_SSO_PROVIDERS,
  SPLASH_BOOT_STEPS,
  SPLASH_STEP_DURATION_MS,
} from "./constants";
