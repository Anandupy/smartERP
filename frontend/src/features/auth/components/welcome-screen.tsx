import Link from "next/link";

import { ArrowRight, Landmark } from "@/assets/icons";
import { AuthSplitLayout } from "@/components/layouts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { appConfig } from "@/config";
import { ROUTES } from "@/constants";
import { FadeIn } from "@/shared";

import { AuthFooter } from "./auth-footer";
import { BrandMark } from "./brand-mark";
import { WelcomeBrandPanel } from "./welcome-brand-panel";

/**
 * The welcome screen: brand introduction plus a single, unambiguous call to
 * action into the login flow.
 *
 * The CTA is a real link (`Button asChild` + `next/link`), so it is keyboard
 * operable, announces as a link, and works before hydration.
 */
export function WelcomeScreen() {
  return (
    <AuthSplitLayout visual={<WelcomeBrandPanel />} footer={<AuthFooter />}>
      <FadeIn className="space-y-8">
        <BrandMark size="sm" className="lg:hidden" />

        <Card className="shadow-ambient [--card-spacing:--spacing(6)] sm:[--card-spacing:--spacing(8)]">
          <CardContent className="space-y-6 text-center">
            <span
              aria-hidden="true"
              className="bg-primary text-primary-foreground shadow-ambient mx-auto flex size-14 items-center justify-center rounded-xl [&_svg]:size-7"
            >
              <Landmark />
            </span>

            <div className="space-y-2">
              <h1 className="text-foreground text-2xl font-semibold tracking-tight">
                Welcome to {appConfig.name}
              </h1>
              <p className="text-muted-foreground text-sm text-balance">
                Enter your enterprise credentials to begin.
              </p>
            </div>

            <Button asChild size="lg" className="h-12 w-full">
              <Link href={ROUTES.auth.login}>
                Continue to login
                <ArrowRight aria-hidden="true" data-icon="inline-end" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </FadeIn>
    </AuthSplitLayout>
  );
}
