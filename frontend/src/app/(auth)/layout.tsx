import { GuestRoute } from "@/core/auth";

/**
 * Layout for the guest-only auth route group. Authenticated users are bounced
 * away by `GuestRoute`; this file wires nothing but the guard.
 *
 * The shell is chosen per page rather than imposed here, because auth screens
 * legitimately differ: splash is full-bleed, welcome/login use `AuthSplitLayout`,
 * and simpler screens use the centered `AuthLayout`.
 */
export default function AuthGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <GuestRoute>{children}</GuestRoute>;
}
