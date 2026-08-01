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
import { AuthMessagePanel } from "./auth-message-panel";
import { AuthStatusScreen } from "./auth-status-screen";

export interface AccountLockedScreenProps {
  /**
   * Seconds remaining on the lockout. The backend owns the real window; this is
   * what it reports, and the screen only reflects it.
   */
  lockoutSeconds?: number;
}

/**
 * Session state: too many failed attempts.
 *
 * A locked-out visitor needs three things, in this order — when they can try
 * again, how to get help now, and what to do differently. Retry stays disabled
 * until the timer clears so the screen never invites an attempt that would only
 * extend the lockout.
 */
export function AccountLockedScreen({
  lockoutSeconds = ACCOUNT_LOCKOUT_SECONDS,
}: AccountLockedScreenProps) {
  const countdown = useCountdown({ seconds: lockoutSeconds });

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
      description="We detected too many failed sign-in attempts. For your security, this account is locked for a short period."
      actions={
        <>
          <Button asChild size="lg" className="h-12 w-full">
            <Link href={`mailto:${SUPPORT_EMAIL}`}>
              <LifeBuoy aria-hidden="true" data-icon="inline-start" />
              Contact administrator
            </Link>
          </Button>

          {countdown.isComplete ? (
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
