import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  admissionMasterConfig,
  AdmissionMasterListScreen,
  isAdmissionMasterType,
} from "@/features/admission-masters";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ resource: string }>;
}): Promise<Metadata> {
  const { resource } = await params;
  if (!isAdmissionMasterType(resource)) return {};
  return { title: admissionMasterConfig(resource).pluralLabel };
}

/**
 * The directory for one admission master resource.
 *
 * `resource` is validated against the registry rather than trusted as-is —
 * an unknown segment 404s instead of silently rendering a blank config.
 */
export default async function AdmissionMasterListPage({
  params,
}: {
  params: Promise<{ resource: string }>;
}) {
  const { resource } = await params;
  if (!isAdmissionMasterType(resource)) notFound();

  return <AdmissionMasterListScreen masterType={resource} />;
}
