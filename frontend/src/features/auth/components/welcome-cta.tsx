"use client";

import Link from "next/link";

import { ArrowRight } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants";
import { completeOnboarding } from "@/core/startup";

/**
 * The welcome screen's call to action, and the moment first-run onboarding is
 * considered done: reaching login from welcome is what the startup flow treats
 * as "seen".
 *
 * Still a real `<Link>`, so it navigates without JavaScript and announces as a
 * link; the flag is a side effect of the click, never a precondition for it. If
 * storage is unavailable the visitor simply sees welcome again next launch.
 */
export function WelcomeCta() {
  return (
    <Button asChild size="lg" className="h-12 w-full">
      <Link href={ROUTES.auth.login} onClick={() => completeOnboarding()}>
        Continue to login
        <ArrowRight aria-hidden="true" data-icon="inline-end" />
      </Link>
    </Button>
  );
}
