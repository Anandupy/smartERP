"use client";

import { useRouter } from "next/navigation";

import { ROUTES } from "@/constants";
import { PageHeader } from "@/shared/components/layout";

import { useUpdateOrganization } from "../hooks/use-organizations";
import {
  toOrganizationFormValues,
  toOrganizationRequest,
} from "../mappers/organization.mapper";
import { OrganizationBoundary } from "./organization-boundary";
import { OrganizationForm } from "./organization-form";

export interface EditOrganizationScreenProps {
  id: string;
}

/** The form, mounted only once its record exists. */
function EditForm({ id }: { id: string }) {
  const router = useRouter();
  const update = useUpdateOrganization(id);

  return (
    <OrganizationBoundary id={id}>
      {(organization) => (
        <div className="space-y-6">
          <PageHeader
            title={`Edit ${organization.name}`}
            description="Changes take effect as soon as they are saved."
          />

          <OrganizationForm
            defaultValues={toOrganizationFormValues(organization)}
            submitLabel="Save changes"
            onCancel={() =>
              router.push(ROUTES.app.organizations.detail(organization.id))
            }
            onSubmit={async (values) => {
              await update.mutateAsync(toOrganizationRequest(values));
              router.push(ROUTES.app.organizations.detail(organization.id));
            }}
          />
        </div>
      )}
    </OrganizationBoundary>
  );
}

/**
 * Edit an existing organization.
 *
 * The form is only mounted once the record has loaded, so `defaultValues` is
 * the real organization rather than blanks that get reset a moment later —
 * resetting a form the user may already be typing into is how edits get
 * silently discarded.
 */
export function EditOrganizationScreen({ id }: EditOrganizationScreenProps) {
  return <EditForm id={id} />;
}
