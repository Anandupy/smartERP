import Link from "next/link";

import { ArrowLeft, ShieldCheck } from "@/assets/icons";
import { AuthSplitLayout } from "@/components/layouts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ROUTES } from "@/constants";
import { FadeIn } from "@/shared";

import { AuthFooter } from "./auth-footer";
import { AuthMessagePanel } from "./auth-message-panel";
import { BrandMark } from "./brand-mark";
import { ForgotPasswordForm } from "./forgot-password-form";

/**
 * Step 1 of password recovery. The form owns validation and submission; this
 * screen owns the shell, the brand panel, and the way back to login.
 */
export function ForgotPasswordScreen() {
  return (
    <AuthSplitLayout
      visual={
        <AuthMessagePanel
          icon={<ShieldCheck />}
          title="Security is our priority."
          description="CampusFlow ERP uses enterprise-grade infrastructure to keep institutional data protected. Recovery requests are encrypted and monitored."
        />
      }
      footer={<AuthFooter />}
    >
      <FadeIn className="space-y-8">
        <BrandMark size="sm" className="lg:hidden" />

        <Card className="shadow-ambient [--card-spacing:--spacing(6)] sm:[--card-spacing:--spacing(8)]">
          <CardHeader className="gap-1">
            <h1 className="text-foreground text-2xl font-semibold tracking-tight">
              Reset your password
            </h1>
            <p className="text-muted-foreground text-sm">
              Enter your institutional email and we&apos;ll send a verification
              code.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <ForgotPasswordForm />
            <Button asChild variant="outline" size="lg" className="h-11 w-full">
              <Link href={ROUTES.auth.login}>
                <ArrowLeft aria-hidden="true" data-icon="inline-start" />
                Back to login
              </Link>
            </Button>
          </CardContent>
        </Card>
      </FadeIn>
    </AuthSplitLayout>
  );
}
