import type { Metadata } from "next";

import { AcademicUnitTreeRoute } from "../program-composition";

export const metadata: Metadata = {
  title: "Academic Unit Hierarchy",
};

/**
 * The structure of the active branch and academic year.
 *
 * Rendered through the route composition, which resolves program names from the
 * Program module — see `../program-composition.tsx` for why the join lives
 * there rather than inside either feature.
 */
export default function AcademicUnitTreePage() {
  return <AcademicUnitTreeRoute />;
}
