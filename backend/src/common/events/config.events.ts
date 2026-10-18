import { DomainEvent } from './domain-event.base';

export interface ConfigChangedPayload {
  key: string;
  scopeType: string;
  scopeId: string | null;
  /** The value in force before the change, or null when none was set at this scope. */
  oldValue: unknown;
  /** The value now in force at this scope, or null when it was cleared. */
  newValue: unknown;
  version: number | null;
  reason: string | null;
  changedBy: string | null;
  organizationId?: string;
  branchId?: string;
}

/**
 * A configuration value was set or cleared (F2 §8).
 *
 * Carries the old value as well as the new one: an audit entry recording only
 * the new value cannot answer "what changed?". Configuration values are
 * policy, never personal data, so the payload is safe to audit as is.
 */
export class ConfigChangedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'config.changed';
  readonly payload: ConfigChangedPayload;

  constructor(payload: ConfigChangedPayload) {
    super({
      eventName: ConfigChangedEvent.EVENT_NAME,
      aggregateId: payload.key,
      aggregateType: 'ConfigValue',
    });
    this.payload = payload;
  }
}
