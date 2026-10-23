import type { Metadata } from "next";

import { BulkImportRoute } from "../applicant-composition";

export const metadata: Metadata = {
  title: "Bulk Admission Entry",
};

/** Bulk entry — one PDF of many filled forms, read and reviewed in a queue. */
export default function BulkImportPage() {
  return <BulkImportRoute />;
}
