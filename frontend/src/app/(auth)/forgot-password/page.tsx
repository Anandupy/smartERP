import type { Metadata } from "next";

import { ForgotPasswordScreen } from "@/features/auth";

export const metadata: Metadata = {
  title: "Reset your password",
  description: "Request a verification code to reset your CampusFlow password.",
};

/** Step 1 of password recovery. UI only in this phase — no code is sent. */
export default function ForgotPasswordPage() {
  return <ForgotPasswordScreen />;
}
