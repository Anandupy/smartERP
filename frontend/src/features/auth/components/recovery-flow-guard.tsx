"use client";

import Link from "next/link";

import { ArrowLeft, TriangleAlert } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants";

import { useRecoveryStore } from "../store/recovery-store";
import { AuthStatusScreen } from "./auth-status-screen";

export interface RecoveryFlowGuardProps {
  /** Also require a verified code (the reset-password step). */
  requireVerified?: boolean;
  /** Rendered with the identifier once the flow state is present. */
  children: (identifier: string) => React.ReactNode;
}

/**
 * Gate for the mid-flow recovery screens.
 *
 * Recovery state is intentionally in memory only (see `store/recovery-store`),
 * so a reload or a deep link lands here with nothing to work from. Rather than
 * rendering a screen addressed to nobody, this sends the visitor back to the
 * start with an explanation.
 */
export function RecoveryFlowGuard({
  requireVerified = false,
  children,
}: RecoveryFlowGuardProps) {
  const identifier = useRecoveryStore((state) => state.identifier);
  const isVerified = useRecoveryStore((state) => state.isVerified);

  if (!identifier || (requireVerified && !isVerified)) {
    return (
      <AuthStatusScreen
        icon={<TriangleAlert />}
        tone="danger"
        title="Start again"
        description="This password reset link is no longer active. Recovery steps expire when the page is reloaded, for your security."
        actions={
          <>
            <Button asChild size="lg" className="h-12 w-full">
              <Link href={ROUTES.auth.forgotPassword}>Reset your password</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-11 w-full">
              <Link href={ROUTES.auth.login}>
                <ArrowLeft aria-hidden="true" data-icon="inline-start" />
                Back to login
              </Link>
            </Button>
          </>
        }
      />
    );
  }

  return <>{children(identifier)}</>;
}
