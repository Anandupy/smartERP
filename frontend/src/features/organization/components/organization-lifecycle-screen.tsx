"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Ban, CircleCheckBig, Power, TriangleAlert } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/constants";
import { cn } from "@/lib/utils";
import { BackendPendingBadge, Banner } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";

import { useDeactivateOrganization } from "../hooks/use-organizations";
import type { OrganizationDto } from "../types/organization.dto";
import {
  LIFECYCLE_STAGES,
  SUPPORTED_STAGES,
  daysUntilExpiry,
  expiryState,
  isCurrentStage,
  type LifecycleStage,
} from "../utils/organization-lifecycle";
import { DeactivateOrganizationDialog } from "./deactivate-organization-dialog";
import { OrganizationBoundary } from "./organization-boundary";
import { OrganizationStatusBadge } from "./organization-status-badge";

/** One stage on the timeline. */
function Stage({
  stage,
  isCurrent,
  isLast,
}: {
  stage: LifecycleStage;
  isCurrent: boolean;
  isLast: boolean;
}) {
  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      {/* The connector to the next stage. Rendered conditionally rather than
          with a `last:` variant, which would key off this span's own position
          among its siblings — it is the first, not the last — and so would
          draw a line trailing off the final stage. */}
      {!isLast ? (
        <span
          aria-hidden="true"
          className="bg-border absolute top-6 bottom-0 left-[0.6875rem] w-px"
        />
      ) : null}

      <span
        aria-hidden="true"
        className={cn(
          "relative z-10 mt-1 flex size-6 shrink-0 items-center justify-center rounded-full border-2",
          isCurrent
            ? "border-primary bg-primary text-primary-foreground"
            : stage.isSupported
              ? "border-border bg-background text-muted-foreground"
              : "border-border bg-background text-muted-foreground border-dashed",
        )}
      >
        {isCurrent ? (
          <CircleCheckBig className="size-3.5" />
        ) : stage.isSupported ? (
          <span className="bg-muted-foreground size-1.5 rounded-full" />
        ) : (
          <Ban className="size-3" />
        )}
      </span>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3
            className={cn(
              "text-sm font-medium",
              stage.isSupported ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {stage.label}
          </h3>
          {isCurrent ? (
            <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium">
              Current
            </span>
          ) : null}
          {!stage.isSupported ? <BackendPendingBadge /> : null}
        </div>
        <p className="text-muted-foreground text-sm">{stage.description}</p>
        <p className="text-muted-foreground text-xs">{stage.transition}</p>
      </div>
    </li>
  );
}

/** The lifecycle view for one loaded organization. */
function Lifecycle({ organization }: { organization: OrganizationDto }) {
  const router = useRouter();
  const deactivate = useDeactivateOrganization();
  const [isConfirming, setIsConfirming] = useState(false);

  const isInactive = organization.status === "INACTIVE";
  const expiry = expiryState(organization.masterExpiryDate);
  const days = daysUntilExpiry(organization.masterExpiryDate);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organization Lifecycle"
        badge={
          <OrganizationStatusBadge status={organization.status} withIcon />
        }
        description={`Operational status and data-retention policy for ${organization.name}.`}
      />

      <Banner
        tone="info"
        icon={TriangleAlert}
        title="Most of this lifecycle is not in the contract"
        description="The API documents three status values and one transition — deactivation. Draft, suspension, expiry-driven changes and permanent deletion have no endpoint, and are marked below rather than simulated."
      />

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            Stages
            <span className="text-muted-foreground text-xs font-normal">
              {SUPPORTED_STAGES.length} of {LIFECYCLE_STAGES.length} reachable
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <ol className="relative">
            {LIFECYCLE_STAGES.map((stage, index) => (
              <Stage
                key={stage.label}
                stage={stage}
                isCurrent={isCurrentStage(stage, organization)}
                isLast={index === LIFECYCLE_STAGES.length - 1}
              />
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Subscription</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <p className="text-sm">
            Master expiry date:{" "}
            <strong>{organization.masterExpiryDate || "not set"}</strong>
            {days !== null ? (
              <span className="text-muted-foreground">
                {" "}
                ({days < 0 ? `${Math.abs(days)} days ago` : `in ${days} days`})
              </span>
            ) : null}
          </p>
          {expiry === "expired" ? (
            <p className="text-destructive text-sm">
              This date has passed. The organization&apos;s status is still{" "}
              {organization.status ?? "unreported"} — expiry does not change it,
              and an expired organization keeps working.
            </p>
          ) : null}
          <p className="text-muted-foreground text-sm">
            Nothing reads this date: expiry changes no status and blocks
            nothing.
          </p>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader className="border-b">
          <CardTitle className="text-destructive flex items-center gap-2">
            <TriangleAlert aria-hidden="true" className="size-4" />
            Danger zone
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-border divide-y pt-0">
          <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium">Deactivate organization</p>
              <p className="text-muted-foreground text-sm">
                Marks the organization inactive. The record and its data are
                preserved — the documentation is explicit that this is a soft
                delete. Every branch and user underneath loses access.
              </p>
            </div>
            <Button
              type="button"
              variant="destructive"
              className="shrink-0"
              disabled={isInactive || deactivate.isPending}
              onClick={() => setIsConfirming(true)}
            >
              <Power />
              {isInactive ? "Already inactive" : "Deactivate"}
            </Button>
          </div>

          <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                Reactivate organization
                <BackendPendingBadge />
              </p>
              <p className="text-muted-foreground text-sm">
                No endpoint reverses a deactivation, and `status` is not part of
                the update body — so this cannot be offered.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              disabled
            >
              Reactivate
            </Button>
          </div>

          <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                Suspend organization
                <BackendPendingBadge />
              </p>
              <p className="text-muted-foreground text-sm">
                `SUSPENDED` is a documented status value, but nothing in the
                contract sets it.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              disabled
            >
              Suspend
            </Button>
          </div>

          <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                Permanent deletion
                <BackendPendingBadge />
              </p>
              <p className="text-muted-foreground text-sm">
                The platform performs soft deletes only. No endpoint removes an
                organization&apos;s records.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              disabled
            >
              Delete permanently
            </Button>
          </div>
        </CardContent>
      </Card>

      <DeactivateOrganizationDialog
        organization={isConfirming ? organization : null}
        isPending={deactivate.isPending}
        onOpenChange={(open) => {
          if (!open) setIsConfirming(false);
        }}
        onConfirm={async () => {
          await deactivate.mutateAsync(organization.id);
          setIsConfirming(false);
          router.push(ROUTES.app.organizations.directory);
        }}
      />
    </div>
  );
}

export interface OrganizationLifecycleScreenProps {
  id: string;
}

/**
 * The organization lifecycle.
 *
 * The design asks for a five-stage timeline — Draft, Active, Suspended,
 * Expired, Deleted — and the contract supports two of those transitions. So
 * the timeline renders all five, in the design's order, with each unsupported
 * stage marked and its reason stated: no status value, no endpoint, or a date
 * that is not a status.
 *
 * That is a deliberate choice over two worse ones. Dropping the stages would
 * hide a gap the backend team needs to see; simulating them client-side would
 * mean this app deciding what "suspended" means and the backend later having
 * to match a state machine it never agreed to.
 *
 * Deactivation is real, and is the only control here that is enabled.
 */
export function OrganizationLifecycleScreen({
  id,
}: OrganizationLifecycleScreenProps) {
  return (
    <OrganizationBoundary id={id}>
      {(organization) => <Lifecycle organization={organization} />}
    </OrganizationBoundary>
  );
}
