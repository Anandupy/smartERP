/**
 * Wire shape for `POST /workspace/configuration`.
 *
 * Transcribed from `workspace-config.dto.ts`, the Prisma `WorkspaceScopeType`
 * enum and `workspace-config.service.ts` on the backend. SUPER_ADMIN +
 * `settings.manage` — the Postman request title says "Super Admin Only"
 * explicitly, the only endpoint in this whole module that states a role
 * restriction in its own text.
 *
 * **This is the module's one hard limit, and it shapes the whole editor:**
 * there is no `GET`, no `list`, no `DELETE` for `WorkspaceConfiguration`. The
 * only way to see a layer is through the merged result on `GET /workspace`,
 * which this module does not fetch. The editor therefore cannot pre-fill an
 * existing layer — every save is "define this layer", not "edit this layer" —
 * and `workspace-config.service.ts` **shallow-merges** whatever is sent into
 * whatever already exists for the same `(scopeType, scopeId)`, one level deep,
 * so omitting a key leaves it untouched rather than clearing it.
 */

/** Documented scope levels. Later layers in this order win when merged for display. */
export const WORKSPACE_SCOPE_TYPES = [
  "PRODUCT",
  "ORGANIZATION",
  "BRANCH",
  "ROLE",
  "USER",
] as const;

export type WorkspaceScopeType = (typeof WORKSPACE_SCOPE_TYPES)[number];

/**
 * Role names valid as `scopeId` when `scopeType` is `ROLE`.
 *
 * The backend documents this scope's `scopeId` as "the role name string
 * (`\"STAFF\"`), not a UUID." These six are the backend's own `UserRole` enum
 * (`common/enums/role.enum.ts`) — reproduced here because that is what a `ROLE`
 * scope layer is keyed by, not guessed.
 */
export const WORKSPACE_ROLE_NAMES = [
  "SUPER_ADMIN",
  "ORG_ADMIN",
  "BRANCH_ADMIN",
  "STAFF",
  "STUDENT",
  "PARENT",
] as const;

export type WorkspaceRoleName = (typeof WORKSPACE_ROLE_NAMES)[number];

/**
 * The two preference blobs. Both are schemaless JSON on the backend — the
 * documented keys are examples, not a contract (`workspace-config.dto.ts`
 * types both as `Record<string, any>`). This module only ever reads/writes the
 * documented example keys; anything else a caller might have stored under a
 * scope is preserved by the shallow merge but never shown, since this UI has
 * no way to know what it means.
 */
export interface NavigationPreferences {
  sidebarCollapsed?: boolean;
  themeMode?: string;
  defaultRoute?: string;
  denseMode?: boolean;
}

export interface ClientPreferences {
  theme?: string;
  locale?: string;
}

/** Body for `POST /workspace/configuration`. */
export interface UpsertWorkspaceConfigurationRequest {
  scopeType: WorkspaceScopeType;
  scopeId?: string | null;
  navigationPreferences?: NavigationPreferences;
  clientPreferences?: ClientPreferences;
}

/** The layer as the backend returns it after upserting. */
export interface WorkspaceConfigurationDto {
  id: string;
  scopeType: WorkspaceScopeType;
  scopeId: string | null;
  navigationPreferences: NavigationPreferences;
  clientPreferences: ClientPreferences;
  isActive: boolean;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}
