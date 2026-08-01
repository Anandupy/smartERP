"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ArrowLeft, ArrowRight, MailCheck, RefreshCw } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants";
import { useCountdown } from "@/hooks";

import { RESEND_COOLDOWN_SECONDS } from "../constants";
import { useRecoveryStore } from "../store/recovery-store";
import { AuthMessagePanel } from "./auth-message-panel";
import { AuthStatusScreen } from "./auth-status-screen";
import { RecoveryFlowGuard } from "./recovery-flow-guard";

export interface EmailSentScreenProps {
  /**
   * Resend handler. Unset in this phase, so the button only restarts the
   * cooldown. Wiring `POST /auth/resend-otp` later means passing its
   * `mutateAsync` here — the throttle and disabled state already work.
   */
  onResend?: () => Promise<void>;
}

/**
 * Step 2 of recovery: confirm where the code went, and offer the two things a
 * visitor actually needs here — send it again, or fix a mistyped address.
 *
 * The resend button is throttled by a visible countdown that mirrors the
 * backend's own limit, so the UI never invites a request the server will reject.
 */
export function EmailSentScreen({ onResend }: EmailSentScreenProps) {
  const router = useRouter();
  const reset = useRecoveryStore((state) => state.reset);
  const cooldown = useCountdown({ seconds: RESEND_COOLDOWN_SECONDS });

  const handleResend = async () => {
    await onResend?.();
    cooldown.restart();
  };

  const handleChangeEmail = () => {
    reset();
    router.push(ROUTES.auth.forgotPassword);
  };

  return (
    <RecoveryFlowGuard>
      {(identifier) => (
        <AuthStatusScreen
          visual={
            <AuthMessagePanel
              icon={<MailCheck />}
              title="Check your inbox."
              description="Verification codes are single-use and expire shortly after they are issued. If one does not arrive, check your spam folder before requesting another."
            />
          }
          icon={<MailCheck />}
          title="Check your email"
          description={
            <>
              We sent a verification code to{" "}
              <strong className="text-foreground font-medium break-all">
                {identifier}
              </strong>
              . Enter it on the next step to continue.
            </>
          }
          actions={
            <>
              <Button asChild size="lg" className="h-12 w-full">
                <Link href={ROUTES.auth.verifyOtp}>
                  Enter verification code
                  <ArrowRight aria-hidden="true" data-icon="inline-end" />
                </Link>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-11 w-full"
                disabled={!cooldown.isComplete}
                onClick={handleResend}
              >
                <RefreshCw aria-hidden="true" data-icon="inline-start" />
                {cooldown.isComplete
                  ? "Resend code"
                  : `Resend in ${cooldown.formatted}`}
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="lg"
                className="h-11 w-full"
                onClick={handleChangeEmail}
              >
                Use a different email
              </Button>
            </>
          }
          note={
            <Link
              href={ROUTES.auth.login}
              className="text-primary inline-flex items-center gap-1.5 rounded-sm underline-offset-4 hover:underline"
            >
              <ArrowLeft aria-hidden="true" className="size-3.5" />
              Back to login
            </Link>
          }
        />
      )}
    </RecoveryFlowGuard>
  );
}
