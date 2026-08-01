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
export { LoginFormConnected } from "./components/login-form-connected";
export { AuthIntegration } from "./components/auth-integration";

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
export {
  RESET_TOKEN_PARAM,
  ResetPasswordScreen,
} from "./components/reset-password-screen";
export { ForgotPasswordFormConnected } from "./components/forgot-password-form-connected";
export { ResetPasswordFormConnected } from "./components/reset-password-form-connected";
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
export { useLockoutStore } from "./store/lockout-store";

// Backend integration
export { authService } from "./api/auth.service";
export { authKeys } from "./api/auth.keys";
export { useLogin } from "./hooks/use-login";
export {
  useForgotPassword,
  useResetPassword,
} from "./hooks/use-password-recovery";
export {
  useLogout,
  useRevokeAllSessions,
  useRevokeSession,
  useSessions,
} from "./hooks/use-sessions";
export {
  useResendOtp,
  useResendVerification,
  useSendOtp,
  useVerifyEmail,
  useVerifyOtp,
} from "./hooks/use-otp";
export {
  getAccountLockedMessage,
  isAccountLockedError,
} from "./utils/auth-errors";
export { decodeAccessToken } from "./utils/jwt";
export {
  clearTokens,
  configureTokenStorage,
  persistTokens,
  refreshSession,
  registerAuthIntegration,
} from "./utils/session-manager";
export {
  toAuthUser,
  toForgotPasswordRequest,
  toLoginRequest,
  toResetPasswordRequest,
  toTokenPair,
} from "./mappers/auth.mapper";
export {
  OTP_PURPOSES,
  type AccessTokenClaims,
  type AuthSessionDto,
  type AuthTokensDto,
  type LoginRequest,
  type OtpPurpose,
} from "./types/auth.dto";
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
