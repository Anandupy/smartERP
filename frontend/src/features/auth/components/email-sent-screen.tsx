"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ArrowLeft, MailCheck, RefreshCw } from "@/assets/icons";
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
   * Resend handler — re-requests the reset email via
   * `POST /auth/forgot-password`. Unset, the button only restarts the cooldown.
   */
  onResend?: () => Promise<void>;
}

/**
 * Step 2 of recovery: confirm the reset email is on its way, and offer the two
 * things a visitor actually needs here — send it again, or fix a mistyped
 * address.
 *
 * There is deliberately **no "continue" action**: the flow resumes in the
 * visitor's inbox, because the emailed link carries the token that authorizes
 * the reset. Offering a next step here would lead nowhere.
 *
 * The resend button is throttled by a visible countdown that mirrors the
 * backend's own limit, so the UI never invites a request the server will reject.
 * The copy stays non-committal about whether the address exists, matching the
 * backend's anti-enumeration response.
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
              description="Reset links are single-use and expire 15 minutes after they are issued. If one does not arrive, check your spam folder before requesting another."
            />
          }
          icon={<MailCheck />}
          title="Check your email"
          description={
            <>
              If an account matches{" "}
              <strong className="text-foreground font-medium break-all">
                {identifier}
              </strong>
              , we&apos;ve sent it a password reset link. Open it to choose a
              new password — the link expires in 15 minutes.
            </>
          }
          actions={
            <>
              {/* Continuing happens in the visitor's inbox, not here: the
                  emailed link carries the token that authorizes the reset. */}
              <Button
                type="button"
                size="lg"
                className="h-12 w-full"
                disabled={!cooldown.isComplete}
                onClick={handleResend}
              >
                <RefreshCw aria-hidden="true" data-icon="inline-start" />
                {cooldown.isComplete
                  ? "Resend email"
                  : `Resend in ${cooldown.formatted}`}
              </Button>

              <Button
                type="button"
                variant="outline"
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
