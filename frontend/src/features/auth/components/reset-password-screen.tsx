"use client";

import Link from "next/link";

import { ArrowLeft, LockKeyhole } from "@/assets/icons";
import { AuthSplitLayout } from "@/components/layouts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ROUTES } from "@/constants";
import { FadeIn } from "@/shared";

import { AuthFooter } from "./auth-footer";
import { AuthMessagePanel } from "./auth-message-panel";
import { BrandMark } from "./brand-mark";
import { RecoveryFlowGuard } from "./recovery-flow-guard";
import { ResetPasswordForm } from "./reset-password-form";

/**
 * Step 4 of recovery: set a new password. Reachable only with a verified code,
 * which `RecoveryFlowGuard` enforces.
 */
export function ResetPasswordScreen() {
  return (
    <RecoveryFlowGuard requireVerified>
      {() => (
        <AuthSplitLayout
          visual={
            <AuthMessagePanel
              icon={<LockKeyhole />}
              title="Choose a strong password."
              description="Your new password must differ from previous ones. Longer passphrases are harder to guess than short, complicated strings."
            />
          }
          footer={<AuthFooter />}
        >
          <FadeIn className="space-y-8">
            <BrandMark size="sm" className="lg:hidden" />

            <Card className="shadow-ambient [--card-spacing:--spacing(6)] sm:[--card-spacing:--spacing(8)]">
              <CardHeader className="gap-1">
                <h1 className="text-foreground text-2xl font-semibold tracking-tight">
                  Create new password
                </h1>
                <p className="text-muted-foreground text-sm">
                  Your new password must be different from previous ones.
                </p>
              </CardHeader>

              <CardContent className="space-y-5">
                <ResetPasswordForm />

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
