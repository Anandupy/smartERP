/**
 * Namespaced keys for browser storage. Centralized to avoid collisions and to
 * make clearing/migrating persisted state trivial.
 */
const NAMESPACE = "campusflow";

const key = (name: string) => `${NAMESPACE}:${name}`;

export const STORAGE_KEYS = Object.freeze({
  accessToken: key("auth.access-token"),
  refreshToken: key("auth.refresh-token"),
  preferences: key("ui.preferences"),
  theme: key("ui.theme"),
});

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
