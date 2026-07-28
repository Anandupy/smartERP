import { DomainEvent } from '@/common/events/domain-event.base';

export class ModuleCreatedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'workspace.module_created';

  constructor(
    public readonly payload: {
      moduleId: string;
      code: string;
      name: string;
      performedBy: string;
    },
  ) {
    super({
      eventName: ModuleCreatedEvent.EVENT_NAME,
      aggregateId: payload.moduleId,
      aggregateType: 'Module',
    });
  }

  get summary(): string {
    return `Workspace module "${this.payload.name}" (${this.payload.code}) was created by user ${this.payload.performedBy}`;
  }
}

export class ModuleUpdatedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'workspace.module_updated';

  constructor(
    public readonly payload: {
      moduleId: string;
      code: string;
      previousState: Record<string, any>;
      newState: Record<string, any>;
      performedBy: string;
    },
  ) {
    super({
      eventName: ModuleUpdatedEvent.EVENT_NAME,
      aggregateId: payload.moduleId,
      aggregateType: 'Module',
    });
  }

  get summary(): string {
    return `Workspace module "${this.payload.code}" was updated by user ${this.payload.performedBy}`;
  }
}

export class MenuCreatedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'workspace.menu_created';

  constructor(
    public readonly payload: {
      menuId: string;
      code: string;
      displayName: string;
      route: string;
      performedBy: string;
    },
  ) {
    super({
      eventName: MenuCreatedEvent.EVENT_NAME,
      aggregateId: payload.menuId,
      aggregateType: 'Menu',
    });
  }

  get summary(): string {
    return `Workspace menu item "${this.payload.displayName}" (${this.payload.code}) route ${this.payload.route} was created by user ${this.payload.performedBy}`;
  }
}

export class MenuUpdatedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'workspace.menu_updated';

  constructor(
    public readonly payload: {
      menuId: string;
      code: string;
      previousState: Record<string, any>;
      newState: Record<string, any>;
      performedBy: string;
    },
  ) {
    super({
      eventName: MenuUpdatedEvent.EVENT_NAME,
      aggregateId: payload.menuId,
      aggregateType: 'Menu',
    });
  }

  get summary(): string {
    return `Workspace menu item "${this.payload.code}" was updated by user ${this.payload.performedBy}`;
  }
}

export class MenuDeletedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'workspace.menu_deleted';

  constructor(
    public readonly payload: {
      menuId: string;
      code: string;
      performedBy: string;
    },
  ) {
    super({
      eventName: MenuDeletedEvent.EVENT_NAME,
      aggregateId: payload.menuId,
      aggregateType: 'Menu',
    });
  }

  get summary(): string {
    return `Workspace menu item "${this.payload.code}" was deleted by user ${this.payload.performedBy}`;
  }
}

export class WorkspaceConfigurationUpdatedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'workspace.config_updated';

  constructor(
    public readonly payload: {
      configId: string;
      scopeType: string;
      scopeId: string | null;
      updatedBy: string;
    },
  ) {
    super({
      eventName: WorkspaceConfigurationUpdatedEvent.EVENT_NAME,
      aggregateId: payload.configId,
      aggregateType: 'WorkspaceConfiguration',
    });
  }

  get summary(): string {
    return `Workspace configuration for scope ${this.payload.scopeType}:${this.payload.scopeId || 'GLOBAL'} was updated by user ${this.payload.updatedBy}`;
  }
}
