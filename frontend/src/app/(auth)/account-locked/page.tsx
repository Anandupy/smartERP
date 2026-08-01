import type { Metadata } from "next";

import { AccountLockedScreen } from "@/features/auth";

export const metadata: Metadata = {
  title: "Account locked",
  description:
    "This account is temporarily locked after failed sign-in attempts.",
};

/**
 * Session state shown after repeated failed sign-ins. The lockout window is
 * display-only until the backend reports the real one.
 */
export default function AccountLockedPage() {
  return <AccountLockedScreen />;
}
