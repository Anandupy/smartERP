import { Building2, Mail } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import type { WorkspaceUnavailableReason } from "@/core/workspace";
import { EmptyState } from "@/shared";

import {
  WORKSPACE_SUPPORT_EMAIL,
  WORKSPACE_UNAVAILABLE_COPY,
} from "../constants";

export interface WorkspaceUnavailableProps {
  reason: WorkspaceUnavailableReason;
}

/**
 * Shown when the user is signed in but no workspace can be formed.
 *
 * Deliberately an empty state rather than an error: nothing failed, and there
 * is nothing to retry. The account is simply not mapped to a scope yet, so the
 * only useful action is reaching the person who can map it — which is why the
 * single call to action is an email rather than a refresh.
 *
 * Which level is missing is decided by the resolver, not here; this component
 * looks the copy up by reason so the two cannot disagree.
 */
export function WorkspaceUnavailable({ reason }: WorkspaceUnavailableProps) {
  const copy = WORKSPACE_UNAVAILABLE_COPY[reason];

  return (
    <EmptyState
      icon={Building2}
      title={copy.title}
      description={copy.description}
      action={
        <Button asChild variant="outline" size="sm">
          <a href={`mailto:${WORKSPACE_SUPPORT_EMAIL}`}>
            <Mail />
            Contact an administrator
          </a>
        </Button>
      }
    />
  );
}
