import { DomainEvent } from './domain-event.base';

export { BranchCreatedEvent } from './examples/branch-created.event';

export class BranchUpdatedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'branch.updated';
  readonly payload: { branchId: string; name?: string; code?: string };

  constructor(
    payload: { branchId: string; name?: string; code?: string },
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: BranchUpdatedEvent.EVENT_NAME,
      aggregateId: payload.branchId,
      aggregateType: 'Branch',
      metadata,
    });
    this.payload = payload;
  }
}

export class BranchDeletedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'branch.deleted';
  readonly payload: { branchId: string };

  constructor(
    payload: { branchId: string },
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: BranchDeletedEvent.EVENT_NAME,
      aggregateId: payload.branchId,
      aggregateType: 'Branch',
      metadata,
    });
    this.payload = payload;
  }
}
