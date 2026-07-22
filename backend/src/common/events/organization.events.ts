import { DomainEvent } from './domain-event.base';

export class OrganizationCreatedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'organization.created';
  readonly payload: { organizationId: string; name: string; code: string };

  constructor(
    payload: { organizationId: string; name: string; code: string },
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: OrganizationCreatedEvent.EVENT_NAME,
      aggregateId: payload.organizationId,
      aggregateType: 'Organization',
      metadata,
    });
    this.payload = payload;
  }
}

export class OrganizationUpdatedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'organization.updated';
  readonly payload: { organizationId: string; name?: string; code?: string };

  constructor(
    payload: { organizationId: string; name?: string; code?: string },
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: OrganizationUpdatedEvent.EVENT_NAME,
      aggregateId: payload.organizationId,
      aggregateType: 'Organization',
      metadata,
    });
    this.payload = payload;
  }
}

export class OrganizationDeletedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'organization.deleted';
  readonly payload: { organizationId: string };

  constructor(
    payload: { organizationId: string },
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: OrganizationDeletedEvent.EVENT_NAME,
      aggregateId: payload.organizationId,
      aggregateType: 'Organization',
      metadata,
    });
    this.payload = payload;
  }
}
