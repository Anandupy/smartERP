"use client";

import { AuthSplitLayout } from "@/components/layouts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/core/auth";
import { useWorkspaceStore } from "@/core/workspace";
import {
  ApiErrorState,
  BrandMark,
  FadeIn,
  LoadingState,
  SelectionSkeleton,
} from "@/shared";

import { useWorkspaceBootstrap } from "../hooks/use-workspace-bootstrap";
import { useWorkspaceRedirect } from "../hooks/use-workspace-redirect";
import { WorkspaceBrandPanel } from "./workspace-brand-panel";
import { WorkspaceIdentity } from "./workspace-identity";
import { WorkspaceSelectionForm } from "./workspace-selection-form";
import { WorkspaceUnavailable } from "./workspace-unavailable";

export interface WorkspaceSelectionScreenProps {
  /** Session-level escapes (sign out), supplied by the route. */
  sessionActions?: React.ReactNode;
}

/**
 * The workspace selection screen.
 *
 * It is the app's single resolution point after sign-in: it loads identity,
 * hands it to the platform, and then renders whichever of five outcomes
 * applies. Which outcome — including whether a user who has only one possible
 * workspace still confirms it — is `resolveWorkspaceAccess`'s decision, not
 * this component's. Under the shipped policy every user entitled to choose sees
 * the three levels and presses Continue; only backend-scoped roles pass
 * straight through.
 *
 * The card's heading is the page `<h1>`, because the greeting on the brand
 * panel is `lg`-and-up only and a heading that disappears on a phone is not a
 * heading.
 */
export function WorkspaceSelectionScreen({
  sessionActions,
}: WorkspaceSelectionScreenProps) {
  const { user } = useAuth();
  const { status, isLoading, error, retry } = useWorkspaceBootstrap();
  const reason = useWorkspaceStore((state) => state.reason);

  useWorkspaceRedirect(status);

  return (
    <AuthSplitLayout
      visual={<WorkspaceBrandPanel name={user?.name} />}
      className="max-w-2xl"
    >
      <FadeIn className="space-y-8">
        <BrandMark size="sm" className="lg:hidden" />

        <Card className="shadow-ambient [--card-spacing:--spacing(6)] sm:[--card-spacing:--spacing(8)]">
          <CardHeader className="gap-1">
            <h1 className="text-foreground text-2xl font-semibold tracking-tight">
              Choose your workspace
            </h1>
            <p className="text-muted-foreground text-sm">
              Pick the organization, campus and academic year you will be
              working in.
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            {user ? (
              <WorkspaceIdentity
                name={user.name}
                email={user.email}
                role={user.roles[0] ?? null}
              />
            ) : null}

            {isLoading ? (
              <SelectionSkeleton label="Loading your workspaces" />
            ) : error ? (
              <ApiErrorState
                error={error}
                title="Unable to load your workspaces"
                onRetry={retry}
                secondaryAction={sessionActions}
              />
            ) : status === "unavailable" && reason ? (
              <WorkspaceUnavailable reason={reason} />
            ) : status === "ready" ? (
              // The redirect is already in flight; this is the half-second
              // between confirming and the app taking over.
              <LoadingState message="Opening your workspace…" />
            ) : (
              <WorkspaceSelectionForm sessionActions={sessionActions} />
            )}
          </CardContent>
        </Card>
      </FadeIn>
    </AuthSplitLayout>
  );
}
