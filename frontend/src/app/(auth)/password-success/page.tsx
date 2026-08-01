import type { Metadata } from "next";

import { PasswordSuccessScreen } from "@/features/auth";

export const metadata: Metadata = {
  title: "Password updated",
  description: "Your CampusFlow password has been reset.",
};

/** Recovery outcome: the password was changed. */
export default function PasswordSuccessPage() {
  return <PasswordSuccessScreen />;
}
