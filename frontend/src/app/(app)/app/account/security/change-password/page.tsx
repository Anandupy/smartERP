import type { Metadata } from "next";

import { ChangePasswordScreen } from "@/features/security";

export const metadata: Metadata = {
  title: "Change Password",
};

export default function ChangePasswordPage() {
  return <ChangePasswordScreen />;
}
