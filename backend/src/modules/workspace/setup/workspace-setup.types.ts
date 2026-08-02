/**
 * The resources a workspace must have before normal operation can begin.
 * Ordered: each stage depends on the one before it.
 */
export const SETUP_RESOURCES = [
  'ORGANIZATION',
  'BRANCH',
  'ACADEMIC_YEAR',
] as const;

export type SetupResource = (typeof SETUP_RESOURCES)[number];

/**
 * The stage a workspace is currently at.
 *
 * - `ORGANIZATION` / `BRANCH` / `ACADEMIC_YEAR` — the resource to create next.
 * - `FINALIZE` — every resource exists; setup awaits explicit completion.
 * - `COMPLETED` — bootstrap is finished and the tenant-header contract applies.
 */
export type WorkspaceSetupStage = SetupResource | 'FINALIZE' | 'COMPLETED';

/**
 * A call the client may make while setup is incomplete.
 *
 * Returned to the client so a setup wizard does not have to hard-code the
 * bootstrap route table.
 */
export interface SetupAction {
  action: string;
  method: string;
  path: string;
  description: string;
}

export interface WorkspaceSetupStatus {
  /** True until the workspace has been explicitly marked initialized. */
  setupRequired: boolean;
  setupStage: WorkspaceSetupStage;
  /** Resources that do not yet exist, in creation order. */
  missingResources: SetupResource[];
  /** Resources that already exist. */
  completedResources: SetupResource[];
  /** Requests permitted while `setupRequired` is true. */
  allowedActions: SetupAction[];
  /** Null until setup is completed. */
  initializedAt: string | null;
}

/**
 * Requests permitted while the workspace is uninitialized.
 *
 * Authentication, roles and permissions still apply to every one of them —
 * this list narrows what a fully authorised user may reach during bootstrap,
 * it does not widen access.
 */
export const SETUP_ALLOWED_ACTIONS: SetupAction[] = [
  {
    action: 'VIEW_PROFILE',
    method: 'GET',
    path: '/auth/me',
    description: 'Read the current user, permissions and setup status.',
  },
  {
    action: 'VIEW_SETUP_STATUS',
    method: 'GET',
    path: '/v1/workspace/setup/status',
    description: 'Read the current setup stage and missing resources.',
  },
  {
    action: 'CREATE_ORGANIZATION',
    method: 'POST',
    path: '/v1/organizations',
    description: 'Create the first organization.',
  },
  {
    action: 'CREATE_BRANCH',
    method: 'POST',
    path: '/v1/branches',
    description: 'Create the first branch.',
  },
  {
    action: 'CREATE_ACADEMIC_YEAR',
    method: 'POST',
    path: '/v1/academic-years',
    description: 'Create the first academic year.',
  },
  {
    action: 'COMPLETE_SETUP',
    method: 'POST',
    path: '/v1/workspace/setup/complete',
    description: 'Mark the workspace initialized once all resources exist.',
  },
];
