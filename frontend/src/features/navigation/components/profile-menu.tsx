"use client";

import Link from "next/link";
import { useTheme } from "next-themes";

import { Monitor, Moon, Settings, Sun } from "@/assets/icons";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROUTES } from "@/constants";
import { useAuth } from "@/core/auth";
import { useMounted } from "@/hooks";
import { initials } from "@/utils";

export interface ProfileMenuProps {
  /**
   * Sign-out control, wired at the route.
   *
   * A slot rather than an import: signing out belongs to the auth feature, and
   * routing it through the layout keeps navigation and authentication from
   * depending on each other — the same arrangement workspace selection uses.
   */
  signOut?: React.ReactNode;
}

/**
 * The user menu: who is signed in, appearance, and the way out.
 *
 * Appearance is here because it is the one preference that is genuinely the
 * user's and needs no backend — `next-themes` persists it locally. The theme
 * radio only renders after mount, since the resolved theme is not knowable on
 * the server and rendering the wrong one would flash.
 */
export function ProfileMenu({ signOut }: ProfileMenuProps) {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const isMounted = useMounted();

  const displayName = user?.name?.trim() || user?.email || "Account";
  const role = user?.roles?.[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Account menu for ${displayName}`}
        >
          <Avatar className="size-7">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
              {initials(displayName)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
              {initials(displayName)}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {displayName}
            </span>
            {user?.email ? (
              <span className="text-muted-foreground block truncate text-xs font-normal">
                {user.email}
              </span>
            ) : null}
            {role ? (
              <span className="text-muted-foreground block truncate text-xs font-normal">
                {role}
              </span>
            ) : null}
          </span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href={ROUTES.app.settings.root}>
            <Settings aria-hidden="true" />
            System settings
          </Link>
        </DropdownMenuItem>

        {isMounted ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Appearance
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
              <DropdownMenuRadioItem value="light">
                <Sun aria-hidden="true" />
                Light
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">
                <Moon aria-hidden="true" />
                Dark
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">
                <Monitor aria-hidden="true" />
                System
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </>
        ) : null}

        {signOut ? (
          <>
            <DropdownMenuSeparator />
            <div className="p-1">{signOut}</div>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
