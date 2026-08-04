import type { Metadata } from "next";

import { AcademicYearDirectoryScreen } from "@/features/academic-year";

export const metadata: Metadata = {
  title: "Academic Year Directory",
};

/** Every academic year of the active branch, searchable and manageable. */
export default function AcademicYearDirectoryPage() {
  return <AcademicYearDirectoryScreen />;
}
