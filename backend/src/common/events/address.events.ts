import { DomainEvent } from './domain-event.base';

/**
 * Address events.
 *
 * Never carry raw address text — line1, city, pincode and every other
 * user-facing field. An event is copied into the outbox, the audit log and
 * every consumer's own storage, so what travels is `personId`, `addressId`
 * and `addressType`, never the physical location itself. The same rule
 * `person.events.ts` documents for government identifiers applies here to a
 * different kind of sensitive value.
 */

export interface PersonAddressAttachedPayload {
  personId: string;
  organizationId: string;
  addressId: string;
  addressType: string;
  /** Whether this replaced an existing open link of the same type. */
  replacedExisting: boolean;
}

export class PersonAddressAttachedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'person_address.attached';
  readonly payload: PersonAddressAttachedPayload;

  constructor(
    payload: PersonAddressAttachedPayload,
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: PersonAddressAttachedEvent.EVENT_NAME,
      aggregateId: payload.personId,
      aggregateType: 'PersonAddress',
      metadata,
    });
    this.payload = payload;
  }
}
