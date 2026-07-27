import { DomainEvent } from '@/common/events/domain-event.base';

export class RolePermissionsUpdatedEvent extends DomainEvent {
  constructor(
    public readonly payload: {
      role: string;
      permissionIds: string[];
      permissionNames: string[];
      updatedBy?: string;
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
      reason?: string;
      createdBy?: string;
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
        ...metadata,
      },
    });
  }
}
