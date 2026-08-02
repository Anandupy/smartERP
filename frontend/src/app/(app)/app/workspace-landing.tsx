"use client";

import { appConfig } from "@/config";
import { useAuth } from "@/core/auth";
import { useWorkspace } from "@/core/workspace";

/**
 * Placeholder body for the app landing page.
 *
 * It exists to prove the scope survives the hand-off, and to show the whole
 * consumer-side API a module needs:
 *
 * ```ts
 * const { organization, branch, academicYear } = useWorkspace();
 * ```
 *
 * No fetching, no props, no prop-drilling from the selection screen — the
 * dashboard that replaces this reads its scope exactly the same way.
 */
export function WorkspaceLanding() {
  const { user } = useAuth();
  const { organization, branch, academicYear } = useWorkspace();

  const scope = [organization?.name, branch?.name, academicYear?.name].filter(
    (part): part is string => Boolean(part),
  );

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm font-medium">
        {appConfig.name} ERP
      </p>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Welcome{user?.name ? `, ${user.name}` : ""}
      </h1>
      {scope.length > 0 ? (
        <p className="text-muted-foreground text-sm">
          You are working in <strong>{scope.join(" · ")}</strong>.
        </p>
      ) : null}
      <p className="text-muted-foreground max-w-prose text-sm">
        The dashboard for this workspace is the next phase. Everything it will
        show is already scoped: the organization, campus and academic year above
        travel with every request as headers.
      </p>
    </div>
  );
}
