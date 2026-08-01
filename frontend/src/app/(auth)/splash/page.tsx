import type { Metadata } from "next";

import { appConfig } from "@/config";
import { SplashScreen } from "@/features/auth";

export const metadata: Metadata = {
  title: "Starting up",
  description: `${appConfig.name} ${appConfig.edition} is starting up.`,
};

/** Brand entry point; hands off to the welcome screen when the boot completes. */
export default function SplashPage() {
  return <SplashScreen />;
}
