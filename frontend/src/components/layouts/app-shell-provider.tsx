"use client";

import { SidebarProvider } from "@/components/ui/sidebar";
import { useUiStore } from "@/store";

/**
 * Binds the sidebar primitive's open state to the platform UI store.
 *
 * `SidebarProvider` keeps its own state and a cookie by default, which would
 * make `useUiStore.isSidebarOpen` a second, silently diverging copy — the store
 * already declares navigation chrome as its responsibility. Driving the
 * primitive from the store instead leaves one source of truth, so anything else
 * that needs to open or collapse the sidebar (a keyboard shortcut, a deep link,
 * a future guided tour) has somewhere to say so.
 *
 * Exists as its own client boundary so `AppLayout` can stay a Server Component:
 * an event handler cannot cross the server/client seam, but this component can.
 */
export function AppShellProvider({ children }: { children: React.ReactNode }) {
  const isSidebarOpen = useUiStore((state) => state.isSidebarOpen);
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);

  return (
    <SidebarProvider open={isSidebarOpen} onOpenChange={setSidebarOpen}>
      {children}
    </SidebarProvider>
  );
}
