"use client";

import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef } from "react";

import { Lock } from "@/assets/icons";
import { Progress } from "@/components/ui/progress";
import { appConfig } from "@/config";
import { ROUTES } from "@/constants";
import { useStartupRoute } from "@/core/startup";
import { FadeIn } from "@/shared";

import { SPLASH_BOOT_STEPS, SPLASH_STEP_DURATION_MS } from "../constants";
import { useBootSequence } from "../hooks/use-boot-sequence";
import { AuthBrandPanel } from "./auth-brand-panel";
import { AuthFooter } from "./auth-footer";
import { BrandMark } from "./brand-mark";

export interface SplashScreenProps {
  /**
   * Override where the boot sequence hands off. Left unset, the destination
   * comes from `useStartupRoute` — the single place startup navigation policy
   * lives — so this screen never decides anything itself.
   */
  redirectTo?: string;
}

/**
 * Brand entry point: the boot sequence that precedes any authenticated work.
 *
 * Full-bleed and centered at every width — no fixed dimensions — with staged
 * entrance animations that collapse to their final state under
 * `prefers-reduced-motion`. The progress bar is determinate so assistive tech
 * reports real progress rather than an endless busy state.
 */
export function SplashScreen({ redirectTo }: SplashScreenProps) {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const startupRoute = useStartupRoute();

  // The startup route resolves after mount (it reads Web Storage), so keep it
  // in a ref: the boot sequence must not restart when it lands.
  const destinationRef = useRef<string | null>(null);
  useEffect(() => {
    destinationRef.current = redirectTo ?? startupRoute;
  }, [redirectTo, startupRoute]);

  const handleComplete = useCallback(() => {
    router.replace(destinationRef.current ?? ROUTES.auth.welcome);
  }, [router]);

  const { label, progress } = useBootSequence({
    steps: SPLASH_BOOT_STEPS,
    stepDurationMs: SPLASH_STEP_DURATION_MS,
    onComplete: handleComplete,
  });

  return (
    <AuthBrandPanel className="min-h-dvh items-center justify-center px-6 py-16">
      <main className="flex w-full max-w-md flex-col items-center">
        <FadeIn>
          <motion.div
            animate={prefersReducedMotion ? undefined : { scale: [1, 1.02, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <BrandMark size="lg" orientation="vertical" />
          </motion.div>
        </FadeIn>

        <FadeIn delay={0.15} className="mt-8 space-y-1 text-center">
          <p className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
            {appConfig.edition}
          </p>
          <p className="text-muted-foreground/70 text-sm">
            Version {appConfig.version}
          </p>
        </FadeIn>

        <FadeIn
          delay={0.3}
          className="mt-12 flex w-full max-w-60 flex-col items-center gap-3"
        >
          <p
            aria-live="polite"
            className="text-primary flex items-center gap-2 text-xs font-medium"
          >
            <Lock aria-hidden="true" className="size-3.5" />
            {label}
          </p>
          <Progress
            value={progress}
            aria-label="Startup progress"
            className="bg-border"
          />
        </FadeIn>
      </main>

      <FadeIn delay={0.3} className="absolute inset-x-0 bottom-6 px-6">
        <AuthFooter className="text-center opacity-70" />
      </FadeIn>
    </AuthBrandPanel>
  );
}
