import { STORAGE_KEYS } from "@/constants";

import { EMPTY_SELECTION } from "./workspace-policy";
import type { WorkspaceSelection } from "./types";

/**
 * Storage abstraction for the last workspace the user chose, mirroring the
 * `token-storage` and `onboarding-storage` seams: the contract is fixed, the
 * backing store is swappable (Web Storage by default, in-memory for tests).
 *
 * Only the three ids are persisted. The entities behind them are server-owned
 * and re-fetched on every sign-in, so a renamed branch or a revoked
 * organization can never be served from a stale cache — the ids are re-checked
 * against what the backend currently offers before anything is selected.
 */
export interface WorkspaceStorage {
  read(): WorkspaceSelection;
  write(selection: WorkspaceSelection): void;
  clear(): void;
}

const hasWindow = typeof window !== "undefined";

/** Accept only the three known id fields, and only as strings or `null`. */
function parseSelection(raw: string | null): WorkspaceSelection {
  if (!raw) return EMPTY_SELECTION;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return EMPTY_SELECTION;
    const record = parsed as Record<string, unknown>;
    const id = (value: unknown) =>
      typeof value === "string" && value.length > 0 ? value : null;
    return {
      organizationId: id(record.organizationId),
      branchId: id(record.branchId),
      academicYearId: id(record.academicYearId),
    };
  } catch {
    // Corrupt or hand-edited storage is not the user's problem: fall back to
    // "nothing chosen", which resolves into the normal selection flow.
    return EMPTY_SELECTION;
  }
}

/** Web Storage backed implementation, guarded for SSR and private-mode throws. */
export function createWebWorkspaceStorage(
  storage: Storage | undefined = hasWindow ? window.localStorage : undefined,
): WorkspaceStorage {
  return {
    read: () => {
      try {
        return parseSelection(
          storage?.getItem(STORAGE_KEYS.workspaceSelection) ?? null,
        );
      } catch {
        // Blocked storage degrades to "choose again", never to a crash.
        return EMPTY_SELECTION;
      }
    },
    write: (selection) => {
      try {
        storage?.setItem(
          STORAGE_KEYS.workspaceSelection,
          JSON.stringify(selection),
        );
      } catch {
        // Non-fatal: the scope still applies for this session.
      }
    },
    clear: () => {
      try {
        storage?.removeItem(STORAGE_KEYS.workspaceSelection);
      } catch {
        // Non-fatal.
      }
    },
  };
}

/** In-memory implementation for tests and non-browser environments. */
export function createMemoryWorkspaceStorage(
  initial: WorkspaceSelection = EMPTY_SELECTION,
): WorkspaceStorage {
  let selection = initial;
  return {
    read: () => selection,
    write: (next) => {
      selection = next;
    },
    clear: () => {
      selection = EMPTY_SELECTION;
    },
  };
}

let activeStorage: WorkspaceStorage = createWebWorkspaceStorage();

export function getWorkspaceStorage(): WorkspaceStorage {
  return activeStorage;
}

export function setWorkspaceStorage(storage: WorkspaceStorage): void {
  activeStorage = storage;
}
