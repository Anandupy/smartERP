"use client";

import { Laptop } from "@/assets/icons";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/core/auth";
import { useSessions } from "@/features/auth";
import { firstNameOf, initialsOf, roleLabelOf } from "@/features/workspace";

/**
 * Who is signed in, and how many devices they're signed in on.
 *
 * Identity comes from `useAuth()` — the same source `ProfileMenu` reads —
 * rather than a second call to `/auth/me`; the session count is the one live
 * number `GET /auth/sessions` actually gives this screen.
 */
export function AccountOverviewCard() {
  const { user } = useAuth();
  const { data: sessions, isPending: sessionsPending } = useSessions();

  const name = user?.name?.trim() || user?.email || "Your account";
  const roleLabel = roleLabelOf(user?.roles?.[0] ?? null);
  const greeting = firstNameOf(user?.name);

  return (
    <Card>
      <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar size="lg" aria-hidden="true">
            <AvatarFallback className="bg-primary/10 text-primary font-medium">
              {initialsOf(user?.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-foreground truncate text-sm font-semibold">
              {greeting ? `Hi, ${greeting}` : name}
            </p>
            {user?.email ? (
              <p className="text-muted-foreground truncate text-xs">
                {user.email}
              </p>
            ) : null}
            {roleLabel ? (
              <Badge variant="secondary" className="mt-1">
                {roleLabel}
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:border-l sm:pl-6">
          <span
            aria-hidden="true"
            className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg"
          >
            <Laptop className="size-4" />
          </span>
          <div>
            <p className="text-muted-foreground text-xs tracking-wide uppercase">
              Active sessions
            </p>
            {sessionsPending ? (
              <Skeleton className="h-6 w-8" />
            ) : (
              <p className="text-foreground text-lg font-semibold">
                {sessions?.length ?? 0}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
