"use client";

import { create } from "zustand";

/**
 * Carries the backend's account-lock message from the failed login to the
 * Account Locked screen.
 *
 * In memory only and deliberately not in the URL: the message is transient
 * feedback, and putting server copy in a query string invites tampering and
 * leaks it into history. If the screen is reached without a message it falls
 * back to its own copy.
 */
interface LockoutState {
  /** The backend message, verbatim. Never re-worded, never parsed. */
  message: string | null;
  setMessage: (message: string) => void;
  clear: () => void;
}

export const useLockoutStore = create<LockoutState>()((set) => ({
  message: null,
  setMessage: (message) => set({ message }),
  clear: () => set({ message: null }),
}));
