import type { Metadata } from "next";

import { SessionExpiredScreen } from "@/features/auth";

export const metadata: Metadata = {
  title: "Session expired",
  description: "Your CampusFlow session ended after a period of inactivity.",
};

/** Session state shown when a session ends through inactivity. */
export default function SessionExpiredPage() {
  return <SessionExpiredScreen />;
}
