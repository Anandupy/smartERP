"use client";

import { LogOut } from "@/assets/icons";
import { Button } from "@/components/ui/button";

import { useLogout } from "../hooks/use-sessions";

export interface SignOutButtonProps {
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  label?: string;
  className?: string;
}

/**
 * Sign out, wherever a screen needs the escape.
 *
 * Signing out is an authentication concern, so it ships from this feature
 * rather than being re-implemented by every screen that offers it — the
 * workspace selection screen composes it through a slot, wired at the route,
 * which keeps the two features from importing each other.
 *
 * Disabled while the request is in flight: `useLogout` clears local state in
 * `onSettled` regardless of the outcome, so a second press would only race the
 * redirect it is already performing.
 */
export function SignOutButton({
  variant = "ghost",
  size = "sm",
  label = "Sign out",
  className,
}: SignOutButtonProps) {
  const logout = useLogout();

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={logout.isPending}
      onClick={() => logout.mutate(undefined)}
    >
      <LogOut />
      {label}
    </Button>
  );
}
