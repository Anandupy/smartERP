import { DomainEvent } from './domain-event.base';

/**
 * Identity events.
 *
 * None of them carries a government identifier, a blind index, a last-4, or any
 * other derivative of a sensitive value. An event is copied into the outbox,
 * the audit log and every consumer's own storage — a payload is the widest
 * possible distribution a value can get, so what travels is `personId` and
 * whether an identifier exists, never what it is.
 */

export interface PersonCreatedPayload {
  personId: string;
  organizationId: string;
  /** Whether an identifier was bound. Deliberately a boolean. */
  hasGovernmentId: boolean;
}

export class PersonCreatedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'person.created';
  readonly payload: PersonCreatedPayload;

  constructor(payload: PersonCreatedPayload, metadata?: Record<string, any>) {
    super({
      eventName: PersonCreatedEvent.EVENT_NAME,
      aggregateId: payload.personId,
      aggregateType: 'Person',
      metadata,
    });
    this.payload = payload;
  }
}

export interface PersonGovernmentIdAttachedPayload {
  personId: string;
  organizationId: string;
  /** The kind of identifier, never the identifier. */
  idType: string;
}

export class PersonGovernmentIdAttachedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'person.government_id_attached';
  readonly payload: PersonGovernmentIdAttachedPayload;

  constructor(
    payload: PersonGovernmentIdAttachedPayload,
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: PersonGovernmentIdAttachedEvent.EVENT_NAME,
      aggregateId: payload.personId,
      aggregateType: 'Person',
      metadata,
    });
    this.payload = payload;
  }
}

export interface PersonMatchReviewedPayload {
  organizationId: string;
  personAId: string;
  personBId: string;
  decision: string;
}

export class PersonMatchReviewedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'person.match_reviewed';
  readonly payload: PersonMatchReviewedPayload;

  constructor(
    payload: PersonMatchReviewedPayload,
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: PersonMatchReviewedEvent.EVENT_NAME,
      aggregateId: payload.personAId,
      aggregateType: 'Person',
      metadata,
    });
    this.payload = payload;
  }
}

export interface PersonSensitiveErasedPayload {
  personId: string;
  organizationId: string;
}

export class PersonSensitiveErasedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'person.sensitive_erased';
  readonly payload: PersonSensitiveErasedPayload;

  constructor(
    payload: PersonSensitiveErasedPayload,
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: PersonSensitiveErasedEvent.EVENT_NAME,
      aggregateId: payload.personId,
      aggregateType: 'Person',
      // Erasure is a statutory action and one of the few things a regulator
      // will ask to see evidence of.
      metadata: { severity: 'WARN', ...metadata },
    });
    this.payload = payload;
  }
}
