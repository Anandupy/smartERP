import Link from "next/link";

import { AuthSplitLayout } from "@/components/layouts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { BrandMark, FadeIn } from "@/shared";

import { AuthFooter } from "./auth-footer";
import { LoginBrandPanel } from "./login-brand-panel";
import { LoginFormConnected } from "./login-form-connected";

/**
 * The sign-in screen: brand panel from `lg` up, credentials card at every
 * width. The card is the page's single landmark task, so its heading is the
 * page `<h1>`.
 */
export function LoginScreen() {
  return (
    <AuthSplitLayout
      visual={<LoginBrandPanel />}
      footer={
        <>
          <p>
            Having trouble?{" "}
            <Link
              href="mailto:support@campusflow.example"
              className="text-primary rounded-sm underline-offset-4 hover:underline"
            >
              Contact IT support
            </Link>
          </p>
          <AuthFooter className="pt-2" />
        </>
      }
    >
      <FadeIn className="space-y-8">
        <BrandMark size="sm" className="lg:hidden" />

        <Card className="shadow-ambient [--card-spacing:--spacing(6)] sm:[--card-spacing:--spacing(8)]">
          <CardHeader className="gap-1">
            <h1 className="text-foreground text-2xl font-semibold tracking-tight">
              Sign in
            </h1>
            <p className="text-muted-foreground text-sm">
              Access your administrative workspace.
            </p>
          </CardHeader>
          <CardContent>
            <LoginFormConnected />
          </CardContent>
        </Card>
      </FadeIn>
    </AuthSplitLayout>
  );
}
