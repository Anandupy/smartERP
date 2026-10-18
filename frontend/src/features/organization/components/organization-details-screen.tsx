"use client";

import Link from "next/link";

import {
  Building2,
  Clock,
  Globe,
  Mail,
  MapPin,
  Pencil,
  Power,
} from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/constants";
import {
  DescriptionList,
  type DescriptionItem,
} from "@/shared/components/data-display";
import { Banner } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";

import { formatAddress } from "../mappers/organization.mapper";
import type { OrganizationDto } from "../types/organization.dto";
import { daysUntilExpiry, expiryState } from "../utils/organization-lifecycle";
import { OrganizationBoundary } from "./organization-boundary";
import { OrganizationStatusBadge } from "./organization-status-badge";

export interface OrganizationDetailsScreenProps {
  id: string;
  /** Activity trail for this organization, wired at the route. */
  activityTrail?: React.ReactNode;
}

/** The expiry notice, when the date says one is warranted. */
function ExpiryBanner({ organization }: { organization: OrganizationDto }) {
  const state = expiryState(organization.masterExpiryDate);
  const days = daysUntilExpiry(organization.masterExpiryDate);

  if (state === "expired") {
    return (
      <Banner
        tone="danger"
        icon={Clock}
        title="Master subscription has expired"
        description={`The expiry date was ${organization.masterExpiryDate}. Expiry does not change status — the organization's status is still ${organization.status ?? "unreported"}, and it keeps working.`}
      />
    );
  }

  if (state === "expiring" && days !== null) {
    return (
      <Banner
        tone="warning"
        icon={Clock}
        title={`Master subscription expires in ${days} day${days === 1 ? "" : "s"}`}
        description={`Expiry date ${organization.masterExpiryDate}.`}
      />
    );
  }

  return null;
}

/** The record itself, once loaded. */
function Details({
  organization,
  activityTrail,
}: {
  organization: OrganizationDto;
  activityTrail?: React.ReactNode;
}) {
  const identity: DescriptionItem[] = [
    { key: "name", label: "Name", value: organization.name },
    {
      key: "code",
      label: "Code",
      value: (
        <code className="bg-muted rounded px-1 py-0.5">
          {organization.code}
        </code>
      ),
    },
    {
      key: "status",
      label: "Status",
      value: <OrganizationStatusBadge status={organization.status} withIcon />,
    },
    {
      key: "expiry",
      label: "Master expiry",
      value: organization.masterExpiryDate || "—",
    },
    ...(organization.logoUrl
      ? [
          {
            key: "logo",
            label: "Logo URL",
            value: (
              <a
                href={organization.logoUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-primary underline-offset-4 hover:underline"
              >
                {organization.logoUrl}
              </a>
            ),
            wide: true,
          } satisfies DescriptionItem,
        ]
      : []),
  ];

  const contact: DescriptionItem[] = [
    {
      key: "email",
      label: "Contact email",
      value: (
        <a
          href={`mailto:${organization.contactEmail}`}
          className="text-primary underline-offset-4 hover:underline"
        >
          {organization.contactEmail}
        </a>
      ),
    },
    {
      key: "phone",
      label: "Contact phone",
      value: (
        <a
          href={`tel:${organization.contactPhone}`}
          className="text-primary underline-offset-4 hover:underline"
        >
          {organization.contactPhone}
        </a>
      ),
    },
  ];

  const regional: DescriptionItem[] = [
    { key: "timezone", label: "Timezone", value: organization.timezone || "—" },
    { key: "currency", label: "Currency", value: organization.currency || "—" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={organization.name}
        badge={
          <OrganizationStatusBadge status={organization.status} withIcon />
        }
        description={formatAddress(organization) || undefined}
        actions={
          <>
            <Button
              asChild
              variant="outline"
              data-guide="organization-details-lifecycle-link"
            >
              <Link href={ROUTES.app.organizations.lifecycle(organization.id)}>
                <Power />
                Lifecycle
              </Link>
            </Button>
            <Button asChild>
              <Link href={ROUTES.app.organizations.edit(organization.id)}>
                <Pencil />
                Edit
              </Link>
            </Button>
          </>
        }
      />

      <ExpiryBanner organization={organization} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <Building2 aria-hidden="true" className="size-4" />
              Identity
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <DescriptionList items={identity} columns={2} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <Mail aria-hidden="true" className="size-4" />
              Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <DescriptionList items={contact} columns={1} />
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
                  value: organization.addressLine1 || "—",
                },
                {
                  key: "line2",
                  label: "Line 2",
                  value: organization.addressLine2 || "—",
                },
                { key: "city", label: "City", value: organization.city || "—" },
                {
                  key: "state",
                  label: "State",
                  value: organization.state || "—",
                },
                {
                  key: "country",
                  label: "Country",
                  value: organization.country || "—",
                },
                {
                  key: "pincode",
                  label: "Postal code",
                  value: organization.pincode || "—",
                },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <Globe aria-hidden="true" className="size-4" />
              Regional
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <DescriptionList items={regional} columns={2} />
          </CardContent>
        </Card>
      </div>

      {activityTrail ? (
        <section className="space-y-3">
          <h2 className="text-foreground text-sm font-medium">
            Activity timeline
          </h2>
          {activityTrail}
        </section>
      ) : null}
    </div>
  );
}

/**
 * One organization in full.
 *
 * Every panel is built from a documented field. The design also shows branch
 * and student counts, primary stakeholders, a legal entity name, a tax id and
 * a license tier — none of which the organization contract contains, and none
 * of which is invented here.
 *
 * The activity timeline is real, but it belongs to the audit module and
 * arrives as a slot wired at the route, so neither feature imports the other.
 * The expiry banner reads `masterExpiryDate`, a documented field, and is
 * careful to present it as a date rather than as a status the backend never
 * reported.
 */
export function OrganizationDetailsScreen({
  id,
  activityTrail,
}: OrganizationDetailsScreenProps) {
  return (
    <OrganizationBoundary id={id}>
      {(organization) => (
        <Details organization={organization} activityTrail={activityTrail} />
      )}
    </OrganizationBoundary>
  );
}
