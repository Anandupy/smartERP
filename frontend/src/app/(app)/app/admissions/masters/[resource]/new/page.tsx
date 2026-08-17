import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  admissionMasterConfig,
  CreateAdmissionMasterScreen,
  isAdmissionMasterType,
} from "@/features/admission-masters";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ resource: string }>;
}): Promise<Metadata> {
  const { resource } = await params;
  if (!isAdmissionMasterType(resource)) return {};
  return { title: `Create ${admissionMasterConfig(resource).singularLabel}` };
}

export default async function CreateAdmissionMasterPage({
  params,
}: {
  params: Promise<{ resource: string }>;
}) {
  const { resource } = await params;
  if (!isAdmissionMasterType(resource)) notFound();

  return <CreateAdmissionMasterScreen masterType={resource} />;
}
