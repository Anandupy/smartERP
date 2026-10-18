"use client";

import Link from "next/link";

import {
  Blocks,
  Building2,
  Landmark,
  Mail,
  MapPin,
  Pencil,
  Power,
  Settings,
} from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/constants";
import {
  DescriptionList,
  type DescriptionItem,
} from "@/shared/components/data-display";
import { BackendPendingNote } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";
import { formatDateTime } from "@/utils";

import {
  BRANCH_STATE_PRESENTATION,
  INSTITUTION_TYPE_PRESENTATION,
  STRUCTURE_MODE_PRESENTATION,
  branchState,
} from "../constants";
import {
  formatAffiliation,
  formatBranchAddress,
} from "../mappers/branch.mapper";
import type { BranchDto } from "../types/branch.dto";
import { BranchBoundary } from "./branch-boundary";
import { BranchStatusBadge } from "./branch-status-badge";

export interface BranchDetailsScreenProps {
  id: string;
  /** Activity trail for this branch, wired at the route. */
  activityTrail?: React.ReactNode;
}

/** The record itself, once loaded. */
function Details({
  branch,
  activityTrail,
}: {
  branch: BranchDto;
  activityTrail?: React.ReactNode;
}) {
  const state = branchState(branch);
  const institution = branch.institutionType
    ? INSTITUTION_TYPE_PRESENTATION[branch.institutionType]
    : null;
  const structure = branch.structureMode
    ? STRUCTURE_MODE_PRESENTATION[branch.structureMode]
    : null;
  const affiliation = formatAffiliation(branch);

  const overview: DescriptionItem[] = [
    { key: "name", label: "Name", value: branch.name },
    {
      key: "code",
      label: "Code",
      value: (
        <code className="bg-muted rounded px-1 py-0.5">{branch.code}</code>
      ),
    },
    {
      key: "registration",
      label: "Registration number",
      value: branch.registrationNumber || "—",
    },
    {
      key: "type",
      label: "Institution type",
      value: institution?.label ?? "—",
    },
    {
      key: "affiliation",
      label: "Affiliation",
      value: affiliation ?? "None declared",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={branch.name}
        badge={<BranchStatusBadge branch={branch} withIcon />}
        description={formatBranchAddress(branch) || undefined}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={ROUTES.app.branches.settings.root(branch.id)}>
                <Settings />
                Settings
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              data-guide="branch-details-lifecycle-link"
            >
              <Link href={ROUTES.app.branches.lifecycle(branch.id)}>
                <Power />
                Lifecycle
              </Link>
            </Button>
            <Button asChild>
              <Link href={ROUTES.app.branches.edit(branch.id)}>
                <Pencil />
                Edit
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <Building2 aria-hidden="true" className="size-4" />
              Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <DescriptionList items={overview} columns={2} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <Mail aria-hidden="true" className="size-4" />
              Contact information
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <DescriptionList
              columns={1}
              items={[
                {
                  key: "email",
                  label: "Contact email",
                  value: (
                    <a
                      href={`mailto:${branch.contactEmail}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {branch.contactEmail}
                    </a>
                  ),
                },
                {
                  key: "phone",
                  label: "Contact phone",
                  value: (
                    <a
                      href={`tel:${branch.contactPhone}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {branch.contactPhone}
                    </a>
                  ),
                },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <MapPin aria-hidden="true" className="size-4" />
              Address
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <DescriptionList
              columns={2}
              items={[
                {
                  key: "line1",
                  label: "Line 1",
                  value: branch.addressLine1 || "—",
                },
                {
                  key: "line2",
                  label: "Line 2",
                  value: branch.addressLine2 || "—",
                },
                { key: "city", label: "City", value: branch.city || "—" },
                { key: "state", label: "State", value: branch.state || "—" },
                {
                  key: "country",
                  label: "Country",
                  value: branch.country || "—",
                },
                {
                  key: "pincode",
                  label: "Postal code",
                  value: branch.pincode || "—",
                },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <Landmark aria-hidden="true" className="size-4" />
              Organization reference
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <DescriptionList
              columns={1}
              items={[
                {
                  key: "organization",
                  label: "Parent organization",
                  value: (
                    <Link
                      href={ROUTES.app.organizations.detail(
                        branch.organizationId,
                      )}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {branch.organization?.name ?? (
                        <code>{branch.organizationId}</code>
                      )}
                    </Link>
                  ),
                },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <Blocks aria-hidden="true" className="size-4" />
              Structure mode
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-4">
            <p className="text-foreground text-sm font-medium">
              {structure?.label ?? "Not reported"}
            </p>
            <p className="text-muted-foreground text-sm">
              {structure?.description ??
                "The backend did not report a structure mode for this branch."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <Power aria-hidden="true" className="size-4" />
              Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <BranchStatusBadge branch={branch} withIcon />
            <p className="text-muted-foreground text-sm">
              {BRANCH_STATE_PRESENTATION[state].description}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href={ROUTES.app.branches.lifecycle(branch.id)}>
                Manage lifecycle
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Branch metadata</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <DescriptionList
            columns={2}
            items={[
              {
                key: "id",
                label: "Branch id",
                value: <code>{branch.id}</code>,
              },
              {
                key: "created",
                label: "Created",
                value: branch.createdAt
                  ? formatDateTime(branch.createdAt)
                  : "—",
              },
              {
                key: "updated",
                label: "Last updated",
                value: branch.updatedAt
                  ? formatDateTime(branch.updatedAt)
                  : "—",
              },
              {
                key: "logo",
                label: "Logo URL",
                value: branch.logoUrl || "—",
                wide: true,
              },
            ]}
          />
          <p className="text-muted-foreground text-sm">
            Who made each change is recorded in the audit trail below.
          </p>
          <BackendPendingNote>
            student, faculty and programme counts are not part of the branch
            contract.
          </BackendPendingNote>
        </CardContent>
      </Card>

      {activityTrail ? (
        <section className="space-y-3">
          <h2 className="text-foreground text-sm font-medium">
            Audit trail &amp; activity
          </h2>
          {activityTrail}
        </section>
      ) : null}
    </div>
  );
}

/**
 * One branch in full.
 *
 * Every panel is built from a documented field. The design also shows total
 * students, faculty members, programmes offered, a parent-organization *name*,
 * an interactive campus map and a branch uptime figure — none of which the
 * branch contract contains. Each is either omitted or named as pending; none is
 * invented.
 *
 * The audit trail is real, but it belongs to the audit module and arrives as a
 * slot wired at the route, so neither feature imports the other.
 */
export function BranchDetailsScreen({
  id,
  activityTrail,
}: BranchDetailsScreenProps) {
  return (
    <BranchBoundary id={id}>
      {(branch) => <Details branch={branch} activityTrail={activityTrail} />}
    </BranchBoundary>
  );
}
