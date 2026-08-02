import { Landmark } from "@/assets/icons";
import { AuthSplitLayout } from "@/components/layouts";
import { Card, CardContent } from "@/components/ui/card";
import { appConfig } from "@/config";
import { BrandMark, FadeIn } from "@/shared";

import { AuthFooter } from "./auth-footer";
import { WelcomeBrandPanel } from "./welcome-brand-panel";
import { WelcomeCta } from "./welcome-cta";

/**
 * The welcome screen: brand introduction plus a single, unambiguous call to
 * action into the login flow.
 *
 * The CTA is a real link (see `WelcomeCta`), so it is keyboard operable,
 * announces as a link, and works before hydration; following it is also what
 * marks first-run onboarding complete.
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

            <WelcomeCta />
          </CardContent>
        </Card>
      </FadeIn>
    </AuthSplitLayout>
  );
}
