import type { Metadata } from "next";

import { CreateAcademicYearScreen } from "@/features/academic-year";

export const metadata: Metadata = {
  title: "New Academic Year",
};

/** Create an academic year in the active branch. */
export default function CreateAcademicYearPage() {
  return <CreateAcademicYearScreen />;
}
