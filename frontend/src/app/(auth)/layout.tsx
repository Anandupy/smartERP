import { AuthLayout } from "@/components/layouts";
import { GuestRoute } from "@/core/auth";

/**
 * Layout for the guest-only auth route group. Authenticated users are bounced
 * away by `GuestRoute`. Login/forgot-password pages are added by the auth
 * feature — this file only wires the shell + guard.
 */
export default function AuthGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <GuestRoute>
      <AuthLayout>{children}</AuthLayout>
    </GuestRoute>
  );
}
