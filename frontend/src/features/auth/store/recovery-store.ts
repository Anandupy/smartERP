"use client";

import { create } from "zustand";

/**
 * The password-recovery flow spans four screens, and each needs what the
 * previous one produced. This feature-scoped store carries that hand-off.
 *
 * Deliberately **not persisted** and deliberately not in the URL: the email
 * identifies an account and the reset token authorizes a password change, so
 * neither belongs in history, bookmarks, or server logs. The cost is that a
 * reload drops the flow — screens detect the empty state and send the visitor
 * back to the start, which is the correct behavior for a recovery flow anyway.
 */
interface RecoveryState {
  /** Email/username/phone the code was sent to (the backend's `identifier`). */
  identifier: string | null;
  /** Set once a code has been verified. */
  isVerified: boolean;
  /**
   * Reset token returned by OTP verification, replayed to
   * `POST /auth/reset-password`. Stays `null` in this UI-only phase.
   */
  resetToken: string | null;
  /** Begin (or restart) recovery for an identifier. */
  startRecovery: (identifier: string) => void;
  /** Record a verified code and the token that authorizes the reset. */
  completeVerification: (resetToken?: string | null) => void;
  /** Clear everything — call once the flow finishes or is abandoned. */
  reset: () => void;
}

const INITIAL = {
  identifier: null,
  isVerified: false,
  resetToken: null,
} as const;

export const useRecoveryStore = create<RecoveryState>()((set) => ({
  ...INITIAL,
  startRecovery: (identifier) =>
    set({ identifier, isVerified: false, resetToken: null }),
  completeVerification: (resetToken = null) =>
    set({ isVerified: true, resetToken }),
  reset: () => set({ ...INITIAL }),
}));
