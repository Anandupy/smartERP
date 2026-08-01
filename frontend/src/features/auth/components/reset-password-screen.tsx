"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { ArrowLeft, LockKeyhole, TriangleAlert } from "@/assets/icons";
import { AuthSplitLayout } from "@/components/layouts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ROUTES } from "@/constants";
import { FadeIn } from "@/shared";

import { AuthFooter } from "./auth-footer";
import { AuthMessagePanel } from "./auth-message-panel";
import { AuthStatusScreen } from "./auth-status-screen";
import { BrandMark } from "./brand-mark";
import { ResetPasswordFormConnected } from "./reset-password-form-connected";

/** Query parameter carrying the single-use token from the reset email. */
export const RESET_TOKEN_PARAM = "token";

/**
 * Final step of password recovery.
 *
 * The backend recovery flow is link-based: `forgot-password` emails a
 * single-use token and this screen consumes it. The token therefore comes from
 * the URL, not from client state — possession of the email is the
 * authorization, which is also why the screen works in a browser that never saw
 * the earlier steps.
 *
 * Arriving without a token means the link was mistyped, truncated by a mail
 * client, or the page was opened directly; that gets an explanation and a way
 * to request a fresh link, never a form that cannot succeed.
 */
export function ResetPasswordScreen() {
  const searchParams = useSearchParams();
  const token = searchParams.get(RESET_TOKEN_PARAM);

  if (!token) {
    return (
      <AuthStatusScreen
        icon={<TriangleAlert />}
        tone="danger"
        title="This reset link is incomplete"
        description="Open the most recent link from your password reset email, or request a new one. Links are single-use and expire shortly after they are sent."
        actions={
          <>
            <Button asChild size="lg" className="h-12 w-full">
              <Link href={ROUTES.auth.forgotPassword}>Request a new link</Link>
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

  return (
    <AuthSplitLayout
      visual={
        <AuthMessagePanel
          icon={<LockKeyhole />}
          title="Choose a strong password."
          description="Your new password must differ from previous ones. Resetting it signs you out of every other device, so any session opened with the old password ends immediately."
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
            <ResetPasswordFormConnected token={token} />

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
  );
}
