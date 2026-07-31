import { AppLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/core/auth";

/**
 * Layout for the authenticated application route group. `ProtectedRoute`
 * enforces authentication; feature pages render inside the app shell. Sidebar
 * and header slots are injected by the navigation feature later.
 */
export default function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  );
}
