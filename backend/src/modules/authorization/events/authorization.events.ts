import { DomainEvent } from '@/common/events/domain-event.base';

export class RolePermissionsUpdatedEvent extends DomainEvent {
  constructor(
    public readonly payload: {
      role: string;
      addedPermissions: string[];
      removedPermissions: string[];
      currentPermissions: string[];
      previousPermissions: string[];
      updatedBy?: string;
      organizationId?: string;
      branchId?: string;
    },
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: 'role_permissions.updated',
      aggregateId: payload.role,
      aggregateType: 'RolePermission',
      metadata: {
        module: 'AUTHORIZATION',
        action: 'UPDATE',
        changes: [
          {
            field: 'addedPermissions',
            oldValue: null,
            newValue: payload.addedPermissions,
          },
          {
            field: 'removedPermissions',
            oldValue: payload.removedPermissions,
            newValue: null,
          },
          {
            field: 'currentPermissions',
            oldValue: payload.previousPermissions,
            newValue: payload.currentPermissions,
          },
        ],
        ...metadata,
      },
    });
  }
}

export class UserPermissionOverrideUpdatedEvent extends DomainEvent {
  constructor(
    public readonly payload: {
      userId: string;
      permissionId: string;
      permissionName: string;
      type: 'GRANT' | 'DENY';
      previousState?: string | null;
      newState: string;
      reason?: string;
      performedBy?: string;
      organizationId?: string;
      branchId?: string;
    },
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: 'user_permission_override.updated',
      aggregateId: `${payload.userId}:${payload.permissionId}`,
      aggregateType: 'UserPermissionOverride',
      metadata: {
        module: 'AUTHORIZATION',
        action: 'UPDATE',
        changes: [
          {
            field: 'type',
            oldValue: payload.previousState ?? null,
            newValue: payload.newState,
          },
          { field: 'reason', oldValue: null, newValue: payload.reason ?? null },
        ],
        ...metadata,
      },
    });
  }
}

export class UserPermissionOverrideDeletedEvent extends DomainEvent {
  constructor(
    public readonly payload: {
      userId: string;
      permissionId: string;
      permissionName?: string;
      previousOverride?: string | null;
      removedBy?: string;
      organizationId?: string;
      branchId?: string;
    },
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: 'user_permission_override.deleted',
      aggregateId: `${payload.userId}:${payload.permissionId}`,
      aggregateType: 'UserPermissionOverride',
      metadata: {
        module: 'AUTHORIZATION',
        action: 'DELETE',
        changes: [
          {
            field: 'type',
            oldValue: payload.previousOverride ?? null,
            newValue: null,
          },
        ],
        ...metadata,
      },
    });
  }
}

export class PermissionDeniedEvent extends DomainEvent {
  constructor(
    public readonly payload: {
      userId: string;
      role: string;
      requiredPermissions: string[];
      missingPermissions: string[];
      route?: string;
      httpMethod?: string;
      organizationId?: string;
      branchId?: string;
      academicYearId?: string;
      requestId?: string;
      traceId?: string;
      correlationId?: string;
    },
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: 'authorization.permission_denied',
      aggregateId: payload.userId,
      aggregateType: 'AuthorizationCheck',
      metadata: {
        module: 'AUTHORIZATION',
        action: 'EXECUTE',
        severity: 'WARNING',
        status: 'FAILED',
        route: payload.route,
        httpMethod: payload.httpMethod,
        ...metadata,
      },
    });
  }
}
