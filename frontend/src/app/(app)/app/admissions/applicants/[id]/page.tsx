import type { Metadata } from "next";

import { ApplicantJourneyHubRoute } from "../applicant-composition";

export const metadata: Metadata = {
  title: "Applicant",
};

/**
 * The Applicant Journey Hub — one application's complete lifecycle in one
 * place. `params` is a promise in the App Router and is awaited here, in the
 * Server Component, so the client route composition receives a plain id.
 */
export default async function ApplicantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ApplicantJourneyHubRoute id={id} />;
}
