"use client";

import Link from "next/link";

import { ArrowLeft, KeyRound, RefreshCw } from "@/assets/icons";
import { AuthSplitLayout } from "@/components/layouts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ROUTES } from "@/constants";
import { useCountdown } from "@/hooks";
import { FadeIn } from "@/shared";

import { RESEND_COOLDOWN_SECONDS } from "../constants";
import { AuthFooter } from "./auth-footer";
import { AuthMessagePanel } from "./auth-message-panel";
import { BrandMark } from "./brand-mark";
import { OtpVerificationForm } from "./otp-verification-form";
import { RecoveryFlowGuard } from "./recovery-flow-guard";

export interface OtpVerificationScreenProps {
  /**
   * Resend handler. Unset in this phase, so the button only restarts the
   * cooldown — `POST /auth/resend-otp` slots in here later.
   */
  onResend?: () => Promise<void>;
}

/**
 * Step 3 of recovery: enter the code that was emailed.
 *
 * The resend affordance is throttled by a visible countdown mirroring the
 * backend's limit, so the UI never invites a request the server would reject.
 */
export function OtpVerificationScreen({
  onResend,
}: OtpVerificationScreenProps) {
  const cooldown = useCountdown({ seconds: RESEND_COOLDOWN_SECONDS });

  const handleResend = async () => {
    await onResend?.();
    cooldown.restart();
  };

  return (
    <RecoveryFlowGuard>
      {(identifier) => (
        <AuthSplitLayout
          visual={
            <AuthMessagePanel
              icon={<KeyRound />}
              title="Identity verification."
              description="One-time codes confirm that a recovery request came from you. Codes are single-use and expire shortly after they are issued."
            />
          }
          footer={<AuthFooter />}
        >
          <FadeIn className="space-y-8">
            <BrandMark size="sm" className="lg:hidden" />

            <Card className="shadow-ambient [--card-spacing:--spacing(6)] sm:[--card-spacing:--spacing(8)]">
              <CardHeader className="gap-1">
                <h1 className="text-foreground text-2xl font-semibold tracking-tight">
                  Enter verification code
                </h1>
                <p className="text-muted-foreground text-sm">
                  We sent a code to{" "}
                  <strong className="text-foreground font-medium break-all">
                    {identifier}
                  </strong>
                  .
                </p>
              </CardHeader>

              <CardContent className="space-y-6">
                <OtpVerificationForm />

                <div className="space-y-3 text-center">
                  <p className="text-muted-foreground text-xs">
                    Didn&apos;t receive the code?
                  </p>
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
                </div>

                <div className="border-border/60 border-t pt-5 text-center">
                  <Link
                    href={ROUTES.auth.login}
                    className="text-primary inline-flex items-center gap-1.5 rounded-sm text-xs underline-offset-4 hover:underline"
                  >
                    <ArrowLeft aria-hidden="true" className="size-3.5" />
                    Back to login
                  </Link>
                </div>
              </CardContent>
            </Card>
          </FadeIn>
        </AuthSplitLayout>
      )}
    </RecoveryFlowGuard>
  );
}
