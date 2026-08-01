import type { Metadata } from "next";

import { LoginScreen } from "@/features/auth";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your CampusFlow administrative workspace.",
};

/** Credential entry. UI only in this phase — no authentication is performed. */
export default function LoginPage() {
  return <LoginScreen />;
}
