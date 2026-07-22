import { DomainEvent } from '../domain-event.base';

export interface BranchCreatedPayload {
  branchId: string;
  name: string;
  code: string;
}

export class BranchCreatedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'branch.created';
  readonly payload: BranchCreatedPayload;

  constructor(payload: BranchCreatedPayload, metadata?: Record<string, any>) {
    super({
      eventName: BranchCreatedEvent.EVENT_NAME,
      aggregateId: payload.branchId,
      aggregateType: 'Branch',
      metadata,
    });
    this.payload = payload;
  }
}
