import { DomainEvent } from './domain-event.base';

export class SystemSettingsUpdatedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'system_settings.updated';
  readonly payload: {
    systemId: string;
    productName?: string;
    environment?: string;
  };

  constructor(
    payload: { systemId: string; productName?: string; environment?: string },
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: SystemSettingsUpdatedEvent.EVENT_NAME,
      aggregateId: payload.systemId,
      aggregateType: 'SystemSetting',
      metadata,
    });
    this.payload = payload;
  }
}
