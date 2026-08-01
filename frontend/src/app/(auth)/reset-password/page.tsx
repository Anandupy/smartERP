import type { Metadata } from "next";
import { Suspense } from "react";

import { ResetPasswordScreen } from "@/features/auth";

export const metadata: Metadata = {
  title: "Create new password",
  description: "Choose a new password for your CampusFlow account.",
};

/**
 * Final step of password recovery, reached from the emailed reset link.
 *
 * The screen reads its token with `useSearchParams`, so it must sit behind a
 * Suspense boundary — without one the whole route would opt out of static
 * rendering.
 */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordScreen />
    </Suspense>
  );
}
