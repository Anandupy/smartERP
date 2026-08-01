import type { Metadata } from "next";

import { WelcomeScreen } from "@/features/auth";

export const metadata: Metadata = {
  title: "Welcome",
  description: "Sign in to your CampusFlow administrative workspace.",
};

/** Brand introduction and entry point into the sign-in flow. */
export default function WelcomePage() {
  return <WelcomeScreen />;
}
