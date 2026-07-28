import { DomainEvent } from './domain-event.base';
import {
  CommunicationChannel,
  NotificationCategory,
  ProviderType,
} from '@/generated/client';

export class NotificationCreatedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'communication.notification_created';
  readonly payload: {
    notificationId: string;
    userId: string;
    title: string;
    category: NotificationCategory;
  };

  constructor(
    payload: NotificationCreatedEvent['payload'],
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: NotificationCreatedEvent.EVENT_NAME,
      aggregateId: payload.notificationId,
      aggregateType: 'InAppNotification',
      metadata,
    });
    this.payload = payload;
  }
}

export class TemplateUpdatedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'communication.template_updated';
  readonly payload: {
    templateId: string;
    code: string;
    channel: CommunicationChannel;
    version: number;
    action: 'CREATE' | 'UPDATE' | 'DELETE';
  };

  constructor(
    payload: TemplateUpdatedEvent['payload'],
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: TemplateUpdatedEvent.EVENT_NAME,
      aggregateId: payload.templateId,
      aggregateType: 'CommunicationTemplate',
      metadata,
    });
    this.payload = payload;
  }
}

export class PreferenceChangedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'communication.preference_changed';
  readonly payload: {
    userId: string;
    category: NotificationCategory;
  };

  constructor(
    payload: PreferenceChangedEvent['payload'],
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: PreferenceChangedEvent.EVENT_NAME,
      aggregateId: payload.userId,
      aggregateType: 'NotificationPreference',
      metadata,
    });
    this.payload = payload;
  }
}

export class ProviderUpdatedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'communication.provider_updated';
  readonly payload: {
    organizationId?: string;
    branchId?: string;
    defaultEmailProvider?: ProviderType;
  };

  constructor(
    payload: ProviderUpdatedEvent['payload'],
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: ProviderUpdatedEvent.EVENT_NAME,
      aggregateId: payload.organizationId || payload.branchId || 'global',
      aggregateType: 'CommunicationSetting',
      metadata,
    });
    this.payload = payload;
  }
}
