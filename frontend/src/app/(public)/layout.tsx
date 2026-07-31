import { PublicLayout } from "@/components/layouts";

/**
 * Layout for the future public/marketing route group (landing pages, docs).
 * Shares the design system without app chrome or auth guards.
 */
export default function PublicGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PublicLayout>{children}</PublicLayout>;
}
