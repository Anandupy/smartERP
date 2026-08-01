import type { Metadata } from "next";

import { ResetPasswordScreen } from "@/features/auth";

export const metadata: Metadata = {
  title: "Create new password",
  description: "Choose a new password for your CampusFlow account.",
};

/** Step 4 of password recovery. UI only in this phase — nothing is persisted. */
export default function ResetPasswordPage() {
  return <ResetPasswordScreen />;
}
