"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { ArrowRight, CheckCircle2, ShieldCheck } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants";
import { useCountdown } from "@/hooks";

import { SUPPORT_EMAIL } from "../constants";
import { AuthMessagePanel } from "./auth-message-panel";
import { AuthStatusScreen } from "./auth-status-screen";

export interface PasswordSuccessScreenProps {
  /**
   * Seconds before returning to login automatically. `0` disables it and leaves
   * the visitor in control.
   *
   * This is the seam for the post-integration behavior: once reset returns a
   * session, this redirect targets the workspace instead of login and only the
   * route changes.
   */
  redirectAfterSeconds?: number;
  /** Where the automatic redirect goes. */
  redirectTo?: string;
}

/**
 * Recovery outcome: the password was changed.
 *
 * The automatic redirect is a courtesy, never the only way forward — the
 * primary button does the same thing immediately, and the remaining time is
 * announced rather than left as a surprise.
 */
export function PasswordSuccessScreen({
  redirectAfterSeconds = 10,
  redirectTo = ROUTES.auth.login,
}: PasswordSuccessScreenProps) {
  const router = useRouter();
  const isAutoRedirecting = redirectAfterSeconds > 0;

  const countdown = useCountdown({
    seconds: redirectAfterSeconds,
    autoStart: isAutoRedirecting,
  });

  useEffect(() => {
    if (isAutoRedirecting && countdown.isComplete) router.push(redirectTo);
  }, [isAutoRedirecting, countdown.isComplete, router, redirectTo]);

  return (
    <AuthStatusScreen
      visual={
        <AuthMessagePanel
          icon={<ShieldCheck />}
          title="Your account is secure."
          description="Any other sessions signed in with your old password remain subject to your institution's security policy. Sign in again to continue working."
        />
      }
      icon={<CheckCircle2 />}
      tone="success"
      title="Password updated"
      description="Your password has been reset. Sign in with your new credentials to continue."
      actions={
        <>
          <Button asChild size="lg" className="h-12 w-full">
            <Link href={ROUTES.auth.login}>
              Return to login
              <ArrowRight aria-hidden="true" data-icon="inline-end" />
            </Link>
          </Button>
          {isAutoRedirecting ? (
            <p aria-live="polite" className="text-muted-foreground text-xs">
              Returning to login in {countdown.formatted}
            </p>
          ) : null}
        </>
      }
      note={
        <>
          Having trouble signing in?{" "}
          <Link
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-primary rounded-sm underline-offset-4 hover:underline"
          >
            Contact IT support
          </Link>
        </>
      }
    />
  );
}
