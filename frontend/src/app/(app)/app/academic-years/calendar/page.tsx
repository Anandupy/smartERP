import type { Metadata } from "next";

import { AcademicYearCalendarScreen } from "@/features/academic-year";

export const metadata: Metadata = {
  title: "Academic Calendar",
};

/**
 * The branch's academic years on one axis.
 *
 * A static segment, so it takes precedence over the sibling `[id]` route — the
 * same arrangement `directory` and `new` already use.
 */
export default function AcademicCalendarPage() {
  return <AcademicYearCalendarScreen />;
}
