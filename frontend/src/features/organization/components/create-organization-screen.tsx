"use client";

import { useRouter } from "next/navigation";

import { ROUTES } from "@/constants";
import { useGuide } from "@/core/guides";
import { PageHeader } from "@/shared/components/layout";

import { useCreateOrganization } from "../hooks/use-organizations";
import { toOrganizationRequest } from "../mappers/organization.mapper";
import { organizationFormDefaults } from "../schemas/organization.schema";
import { OrganizationForm } from "./organization-form";

/**
 * Create an organization.
 *
 * On success the new record's detail screen is the destination rather than the
 * directory: the person who just created an organization is far more likely to
 * want to look at it than to look at the list they came from.
 */
export function CreateOrganizationScreen() {
  const router = useRouter();
  const create = useCreateOrganization();
  const guide = useGuide("organizations");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Organization"
        description="The foundational identity and administrative settings for a new institutional tenant."
      />

      <OrganizationForm
        defaultValues={organizationFormDefaults()}
        submitLabel="Create organization"
        submitGuideTarget="organization-create-submit"
        onCancel={() => router.push(ROUTES.app.organizations.directory)}
        onSubmit={async (values) => {
          const created = await create.mutateAsync(
            toOrganizationRequest(values),
          );
          router.push(ROUTES.app.organizations.detail(created.id));
          guide.reportEvent({ entityId: created.id });
        }}
      />
    </div>
  );
}
