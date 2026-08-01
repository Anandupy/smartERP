import type { Metadata } from "next";

import { OtpVerificationScreen } from "@/features/auth";

export const metadata: Metadata = {
  title: "Enter verification code",
  description: "Enter the six-digit code sent to your institutional email.",
};

/** Step 3 of password recovery. UI only in this phase — no code is verified. */
export default function VerifyOtpPage() {
  return <OtpVerificationScreen />;
}
