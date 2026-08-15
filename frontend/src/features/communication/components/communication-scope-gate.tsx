import Link from "next/link";

import { MessageSquare } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants";
import { EmptyState } from "@/shared/components/feedback";

/**
 * The "no active scope" panel every Communication screen falls back to.
 *
 * Settings, analytics and delivery logs all document `organizationId` and
 * `branchId` as required query parameters, and template/notification writes
 * carry them in the body — so every one of this module's requests needs a
 * resolved workspace scope. This says so directly rather than firing a
 * request with half a scope.
 */
export function CommunicationNoScopeState() {
  return (
    <EmptyState
      icon={MessageSquare}
      title="No active branch"
      description="Communication settings, delivery logs and analytics are scoped to an organization and branch. Choose a workspace to continue."
      action={
        <Button asChild variant="outline">
          <Link href={ROUTES.workspace.root}>Change workspace</Link>
        </Button>
      }
    />
  );
}
