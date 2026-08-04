import type { Metadata } from "next";

import { AcademicYearLifecycleScreen } from "@/features/academic-year";

export const metadata: Metadata = {
  title: "Academic Year Lifecycle",
};

/** Activation, selection, locking and deletion for one academic year. */
export default async function AcademicYearLifecyclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AcademicYearLifecycleScreen id={id} />;
}
