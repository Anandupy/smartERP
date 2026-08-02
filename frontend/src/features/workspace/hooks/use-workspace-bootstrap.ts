"use client";

import { useEffect, useRef } from "react";

import { useAuth } from "@/core/auth";
import { useWorkspaceStore, type WorkspaceStatus } from "@/core/workspace";

import {
  toIdentityUser,
  toWorkspaceAvailability,
} from "../mappers/identity.mapper";
import { useIdentity } from "./use-identity";

export interface WorkspaceBootstrap {
  /** Resolution outcome; `idle` until identity has loaded. */
  status: WorkspaceStatus;
  isLoading: boolean;
  error: unknown;
  /** Re-run the identity query after a failure. */
  retry: () => void;
}

/**
 * Turn a loaded identity into an operating context.
 *
 * This is the seam the whole phase hangs on. It fetches `/auth/me` once and
 * publishes it in two directions:
 *
 * - the **user and permissions** go to `core/auth`, which finally replaces the
 *   token-claim stand-in — `name` becomes a real name and `can()` stops
 *   failing closed;
 * - the **available scopes and backend defaults** go to `core/workspace`,
 *   which runs the resolution policy over them.
 *
 * Publishing rather than deciding is the point: this hook never says where to
 * navigate. `resolveWorkspaceAccess` decides whether a choice exists, and
 * `resolvePostAuthRoute` decides where that leads.
 */
export function useWorkspaceBootstrap(): WorkspaceBootstrap {
  const query = useIdentity();
  const { user, setUser } = useAuth();
  const setAvailability = useWorkspaceStore((state) => state.setAvailability);
  const status = useWorkspaceStore((state) => state.status);

  // The claim-derived user is only a fallback for fields `/auth/me` may omit.
  // Held in a ref so publishing the merged user cannot re-trigger the effect
  // below — depending on `user` there would loop, since that effect sets it.
  const fallbackUser = useRef(user);
  useEffect(() => {
    fallbackUser.current = user;
  }, [user]);

  useEffect(() => {
    if (!query.data) return;
    setUser(toIdentityUser(query.data, fallbackUser.current));
    setAvailability(toWorkspaceAvailability(query.data));
  }, [query.data, setUser, setAvailability]);

  return {
    status,
    // `enabled: false` before authentication reports `pending` without ever
    // fetching, which would otherwise render as a permanent skeleton.
    isLoading: query.isPending && query.fetchStatus !== "idle",
    error: query.error,
    retry: () => void query.refetch(),
  };
}
