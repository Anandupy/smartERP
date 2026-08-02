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
  /**
   * The workspace the user last chose, stored as three ids — never the entities
   * themselves, which are server-owned and re-fetched on every sign-in.
   */
  workspaceSelection: key("workspace.selection"),
  /**
   * Whether the visitor has been through first-run onboarding. Spelled with
   * dots instead of the `campusflow:` namespace because the startup-flow
   * contract fixes this exact key — see `core/startup`.
   */
  onboardingCompleted: `${NAMESPACE}.onboarding.completed`,
});

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
