import type { Metadata } from "next";

import { EmailSentScreen } from "@/features/auth";

export const metadata: Metadata = {
  title: "Check your email",
  description: "We sent a verification code to your institutional email.",
};

/** Step 2 of password recovery: confirmation and resend. */
export default function EmailSentPage() {
  return <EmailSentScreen />;
}
