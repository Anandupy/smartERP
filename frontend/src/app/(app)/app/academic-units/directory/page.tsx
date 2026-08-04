import type { Metadata } from "next";

import { AcademicUnitDirectoryRoute } from "../program-composition";

export const metadata: Metadata = {
  title: "Academic Unit Directory",
};

/** Every unit in the active scope, flat and filterable. */
export default function AcademicUnitDirectoryPage() {
  return <AcademicUnitDirectoryRoute />;
}
