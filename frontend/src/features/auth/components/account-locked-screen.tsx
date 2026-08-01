"use client";

import Link from "next/link";

import { Check, LifeBuoy, Lock, ShieldCheck } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants";
import { useCountdown } from "@/hooks";

import {
  ACCOUNT_LOCKED_TIPS,
  ACCOUNT_LOCKOUT_SECONDS,
  SUPPORT_EMAIL,
} from "../constants";
import { useLockoutStore } from "../store/lockout-store";
import { AuthMessagePanel } from "./auth-message-panel";
import { AuthStatusScreen } from "./auth-status-screen";

export interface AccountLockedScreenProps {
  /**
   * Seconds remaining on the lockout, used only for the fallback countdown when
   * the screen is reached without a backend message.
   */
  lockoutSeconds?: number;
}

/**
 * Session state: too many failed attempts.
 *
 * A locked-out visitor needs three things, in this order — when they can try
 * again, how to get help now, and what to do differently.
 *
 * When the backend supplied a message it is shown **verbatim** and the local
 * countdown is suppressed: the server already states how long the lock lasts,
 * and the alternative would be parsing a duration out of its copy — which would
 * break the moment that copy changed, and would show a second, contradictory
 * timer if it drifted. Reaching this screen directly (no message) falls back to
 * the designed countdown.
 */
export function AccountLockedScreen({
  lockoutSeconds = ACCOUNT_LOCKOUT_SECONDS,
}: AccountLockedScreenProps) {
  const backendMessage = useLockoutStore((state) => state.message);
  const countdown = useCountdown({ seconds: lockoutSeconds });
  const showCountdown = !backendMessage;
  const canReturnToLogin = Boolean(backendMessage) || countdown.isComplete;

  return (
    <AuthStatusScreen
      visual={
        <AuthMessagePanel
          icon={<ShieldCheck />}
          title="Secure workspace."
          description="Access to CampusFlow ERP is protected by automated monitoring of authentication patterns. Temporary locks are applied after repeated failed attempts."
        />
      }
      icon={<Lock />}
      tone="danger"
      title="Account temporarily locked"
      description={
        backendMessage ??
        "We detected too many failed sign-in attempts. For your security, this account is locked for a short period."
      }
      actions={
        <>
          <Button asChild size="lg" className="h-12 w-full">
            <Link href={`mailto:${SUPPORT_EMAIL}`}>
              <LifeBuoy aria-hidden="true" data-icon="inline-start" />
              Contact administrator
            </Link>
          </Button>

          {canReturnToLogin ? (
            <Button asChild variant="outline" size="lg" className="h-11 w-full">
              <Link href={ROUTES.auth.login}>Return to login</Link>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="lg"
              disabled
              className="h-11 w-full"
            >
              Return to login
            </Button>
          )}

          <Button asChild variant="ghost" size="lg" className="h-11 w-full">
            <Link href={ROUTES.auth.forgotPassword}>Reset your password</Link>
          </Button>
        </>
      }
    >
      {showCountdown ? (
        <div className="bg-muted/50 border-border/60 rounded-lg border p-4">
          <p className="text-muted-foreground text-xs tracking-wider uppercase">
            {countdown.isComplete ? "Lock released" : "Unlocks in"}
          </p>
          <p
            aria-live="polite"
            className="text-primary mt-1 text-3xl font-semibold tabular-nums"
          >
            {countdown.formatted}
          </p>
        </div>
      ) : null}

      <ul className="space-y-2 text-left">
        {ACCOUNT_LOCKED_TIPS.map((tip) => (
          <li
            key={tip}
            className="text-muted-foreground flex items-start gap-2 text-xs"
          >
            <Check
              aria-hidden="true"
              className="text-primary mt-0.5 size-3.5"
            />
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </AuthStatusScreen>
  );
}
