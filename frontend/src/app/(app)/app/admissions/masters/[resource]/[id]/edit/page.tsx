import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  admissionMasterConfig,
  EditAdmissionMasterScreen,
  isAdmissionMasterType,
} from "@/features/admission-masters";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ resource: string }>;
}): Promise<Metadata> {
  const { resource } = await params;
  if (!isAdmissionMasterType(resource)) return {};
  return { title: `Edit ${admissionMasterConfig(resource).singularLabel}` };
}

export default async function EditAdmissionMasterPage({
  params,
}: {
  params: Promise<{ resource: string; id: string }>;
}) {
  const { resource, id } = await params;
  if (!isAdmissionMasterType(resource)) notFound();

  return <EditAdmissionMasterScreen masterType={resource} id={id} />;
}
