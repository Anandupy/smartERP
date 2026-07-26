import { DomainEvent } from './domain-event.base';

export class MaintenanceRuleCreatedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'maintenance_rule.created';
  readonly payload: any;

  constructor(payload: any, metadata?: Record<string, any>) {
    super({
      eventName: MaintenanceRuleCreatedEvent.EVENT_NAME,
      aggregateId: payload.id,
      aggregateType: 'MaintenanceRule',
      metadata,
    });
    this.payload = payload;
  }
}

export class MaintenanceRuleUpdatedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'maintenance_rule.updated';
  readonly payload: any;

  constructor(payload: any, metadata?: Record<string, any>) {
    super({
      eventName: MaintenanceRuleUpdatedEvent.EVENT_NAME,
      aggregateId: payload.id,
      aggregateType: 'MaintenanceRule',
      metadata,
    });
    this.payload = payload;
  }
}

export class MaintenanceRuleDeletedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'maintenance_rule.deleted';
  readonly payload: any;

  constructor(payload: any, metadata?: Record<string, any>) {
    super({
      eventName: MaintenanceRuleDeletedEvent.EVENT_NAME,
      aggregateId: payload.id,
      aggregateType: 'MaintenanceRule',
      metadata,
    });
    this.payload = payload;
  }
}
