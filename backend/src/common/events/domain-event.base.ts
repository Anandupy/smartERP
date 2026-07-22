import { v7 as uuidv7 } from 'uuid';

export interface DomainEventParams {
  eventName: string;
  aggregateId: string;
  aggregateType: string;
  version?: number;
  metadata?: Record<string, any>;
  eventId?: string;
  occurredAt?: Date;
}

export abstract class DomainEvent {
  readonly eventId: string;
  readonly eventName: string;
  readonly occurredAt: Date;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly version: number;
  readonly metadata?: Record<string, any>;

  constructor(params: DomainEventParams) {
    this.eventId = params.eventId ?? uuidv7();
    this.eventName = params.eventName;
    this.occurredAt = params.occurredAt ?? new Date();
    this.aggregateId = params.aggregateId;
    this.aggregateType = params.aggregateType;
    this.version = params.version ?? 1;
    this.metadata = params.metadata;
  }
}
