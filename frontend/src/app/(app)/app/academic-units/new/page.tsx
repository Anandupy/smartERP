import type { Metadata } from "next";

import { CreateAcademicUnitRoute } from "../program-composition";

export const metadata: Metadata = {
  title: "New Academic Unit",
};

/**
 * Create an academic unit.
 *
 * The program selector is slotted in by the route composition: a unit's request
 * body names a `programId`, and the two features meet here rather than by
 * importing each other.
 */
export default function CreateAcademicUnitPage() {
  return <CreateAcademicUnitRoute />;
}
