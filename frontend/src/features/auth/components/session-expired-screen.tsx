"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { History, TimerOff } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants";
import { useCountdown } from "@/hooks";

import { AuthMessagePanel } from "./auth-message-panel";
import { AuthStatusScreen } from "./auth-status-screen";

export interface SessionExpiredScreenProps {
  /**
   * Seconds before returning to login automatically. `0` disables it.
   *
   * The seam for integration: once `POST /auth/refresh` exists, this screen
   * attempts a silent refresh first and only falls back to this countdown when
   * the refresh token is genuinely gone.
   */
  redirectAfterSeconds?: number;
  /** Human-readable time since the last activity, when the platform knows it. */
  lastActiveLabel?: string;
}

/**
 * Session state: the session ended through inactivity.
 *
 * Explains why rather than just reporting it, and keeps signing in one click
 * away. The automatic redirect is a convenience with a visible timer, never the
 * only route forward.
 */
export function SessionExpiredScreen({
  redirectAfterSeconds = 15,
  lastActiveLabel,
}: SessionExpiredScreenProps) {
  const router = useRouter();
  const isAutoRedirecting = redirectAfterSeconds > 0;

  const countdown = useCountdown({
    seconds: redirectAfterSeconds,
    autoStart: isAutoRedirecting,
  });

  useEffect(() => {
    if (isAutoRedirecting && countdown.isComplete) {
      router.push(ROUTES.auth.login);
    }
  }, [isAutoRedirecting, countdown.isComplete, router]);

  return (
    <AuthStatusScreen
      visual={
        <AuthMessagePanel
          icon={<TimerOff />}
          title="Secure session management."
          description="Sessions end automatically after a period of inactivity so institutional data is never left open on an unattended device."
        />
      }
      icon={<TimerOff />}
      tone="danger"
      title="Session expired"
      description="For your security, we end sessions after a period of inactivity. Sign in again to pick up where you left off."
      actions={
        <>
          <Button asChild size="lg" className="h-12 w-full">
            <Link href={ROUTES.auth.login}>Login again</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-11 w-full">
            <Link href={ROUTES.root}>Return home</Link>
          </Button>
          {isAutoRedirecting ? (
            <p aria-live="polite" className="text-muted-foreground text-xs">
              Redirecting to login in {countdown.formatted}
            </p>
          ) : null}
        </>
      }
    >
      {lastActiveLabel ? (
        <div className="bg-muted/50 border-border/60 text-muted-foreground flex items-center justify-center gap-2 rounded-lg border p-3 text-xs">
          <History aria-hidden="true" className="size-3.5" />
          <span>
            Last active:{" "}
            <span className="text-foreground font-medium">
              {lastActiveLabel}
            </span>
          </span>
        </div>
      ) : null}
    </AuthStatusScreen>
  );
}
