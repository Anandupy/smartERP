"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import type { SessionContextValue, SessionScope } from "./types";

const SessionContext = createContext<SessionContextValue | null>(null);

const EMPTY_SCOPE: SessionScope = {
  tenantId: null,
  branchId: null,
  academicYearId: null,
  workspaceId: null,
};

/**
 * Holds the active operating scope (tenant / branch / academic year /
 * workspace). Header providers in the core API layer read from here once wired.
 * Ships empty; the workspace feature populates it later.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [scope, setScope] = useState<SessionScope>(EMPTY_SCOPE);

  const updateScope = useCallback((next: Partial<SessionScope>) => {
    setScope((current) => ({ ...current, ...next }));
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({ ...scope, setScope: updateScope }),
    [scope, updateScope],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a <SessionProvider>.");
  }
  return context;
}
