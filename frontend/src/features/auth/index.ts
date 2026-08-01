/**
 * Public surface of the auth feature. Outside code (routes, other platform
 * wiring) imports ONLY from here — never from a file inside the module.
 *
 * This phase ships every authentication screen as UI: the entry screens
 * (splash, welcome, login), the password-recovery flow, and the two session
 * states. No screen calls the backend yet; each form takes an optional
 * `onSubmit`, which is where the mutation slots in. See
 * `docs/authentication.md` for the endpoint map and the remaining seams.
 */

// Entry screens
export {
  SplashScreen,
  type SplashScreenProps,
} from "./components/splash-screen";
export { WelcomeScreen } from "./components/welcome-screen";
export { WelcomeCta } from "./components/welcome-cta";
export { LoginScreen } from "./components/login-screen";
export { LoginForm, type LoginFormProps } from "./components/login-form";

// Password recovery, in flow order
export { ForgotPasswordScreen } from "./components/forgot-password-screen";
export {
  ForgotPasswordForm,
  type ForgotPasswordFormProps,
} from "./components/forgot-password-form";
export {
  EmailSentScreen,
  type EmailSentScreenProps,
} from "./components/email-sent-screen";
export {
  OtpVerificationScreen,
  type OtpVerificationScreenProps,
} from "./components/otp-verification-screen";
export {
  OtpVerificationForm,
  type OtpVerificationFormProps,
} from "./components/otp-verification-form";
export { ResetPasswordScreen } from "./components/reset-password-screen";
export {
  ResetPasswordForm,
  type ResetPasswordFormProps,
} from "./components/reset-password-form";
export {
  PasswordSuccessScreen,
  type PasswordSuccessScreenProps,
} from "./components/password-success-screen";

// Session states
export {
  AccountLockedScreen,
  type AccountLockedScreenProps,
} from "./components/account-locked-screen";
export {
  SessionExpiredScreen,
  type SessionExpiredScreenProps,
} from "./components/session-expired-screen";

// Shared building blocks
export { BrandMark, type BrandMarkProps } from "./components/brand-mark";
export { AuthFooter, type AuthFooterProps } from "./components/auth-footer";
export {
  AuthStatusScreen,
  type AuthStatusScreenProps,
  type AuthStatusTone,
} from "./components/auth-status-screen";
export {
  AuthMessagePanel,
  type AuthMessagePanelProps,
} from "./components/auth-message-panel";
export {
  RecoveryFlowGuard,
  type RecoveryFlowGuardProps,
} from "./components/recovery-flow-guard";

// Hooks, state and contracts
export {
  useBootSequence,
  type BootSequenceState,
  type UseBootSequenceOptions,
} from "./hooks/use-boot-sequence";
export { useRecoveryStore } from "./store/recovery-store";
export {
  loginFormDefaults,
  loginFormSchema,
  type LoginFormValues,
} from "./schemas/login.schema";
export {
  OTP_LENGTH,
  forgotPasswordFormDefaults,
  forgotPasswordFormSchema,
  otpFormDefaults,
  otpFormSchema,
  resetPasswordFormDefaults,
  resetPasswordFormSchema,
  type ForgotPasswordFormValues,
  type OtpFormValues,
  type ResetPasswordFormValues,
} from "./schemas/recovery.schema";
export {
  ACCOUNT_LOCKED_TIPS,
  ACCOUNT_LOCKOUT_SECONDS,
  AUTH_TRUST_BADGES,
  LOGIN_SSO_PROVIDERS,
  RESEND_COOLDOWN_SECONDS,
  SPLASH_BOOT_STEPS,
  SPLASH_STEP_DURATION_MS,
  SUPPORT_EMAIL,
} from "./constants";
