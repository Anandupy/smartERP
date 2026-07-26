import { DomainEvent } from '@/common/events/domain-event.base';
import { CommunicationChannel, NotificationCategory, ProviderType } from '@/generated/client';

export class PasswordResetRequestedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'communication.password_reset_requested';
  readonly payload: {
    userId?: string;
    email: string;
    resetToken?: string;
    rawOtp?: string;
    userName?: string;
    expiresInMinutes?: number;
  };

  constructor(payload: PasswordResetRequestedEvent['payload'], metadata?: Record<string, any>) {
    super({
      eventName: PasswordResetRequestedEvent.EVENT_NAME,
      aggregateId: payload.userId || payload.email,
      aggregateType: 'User',
      metadata,
    });
    this.payload = payload;
  }
}

export class PasswordChangedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'communication.password_changed';
  readonly payload: {
    userId: string;
    email: string;
    userName?: string;
  };

  constructor(payload: PasswordChangedEvent['payload'], metadata?: Record<string, any>) {
    super({
      eventName: PasswordChangedEvent.EVENT_NAME,
      aggregateId: payload.userId,
      aggregateType: 'User',
      metadata,
    });
    this.payload = payload;
  }
}

export class EmailVerificationRequestedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'communication.email_verification_requested';
  readonly payload: {
    userId: string;
    email: string;
    rawOtp?: string;
    verificationLink?: string;
  };

  constructor(payload: EmailVerificationRequestedEvent['payload'], metadata?: Record<string, any>) {
    super({
      eventName: EmailVerificationRequestedEvent.EVENT_NAME,
      aggregateId: payload.userId,
      aggregateType: 'User',
      metadata,
    });
    this.payload = payload;
  }
}

export class NotificationCreatedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'communication.notification_created';
  readonly payload: {
    notificationId: string;
    userId: string;
    title: string;
    category: NotificationCategory;
  };

  constructor(payload: NotificationCreatedEvent['payload'], metadata?: Record<string, any>) {
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

  constructor(payload: TemplateUpdatedEvent['payload'], metadata?: Record<string, any>) {
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

  constructor(payload: PreferenceChangedEvent['payload'], metadata?: Record<string, any>) {
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

  constructor(payload: ProviderUpdatedEvent['payload'], metadata?: Record<string, any>) {
    super({
      eventName: ProviderUpdatedEvent.EVENT_NAME,
      aggregateId: payload.organizationId || payload.branchId || 'global',
      aggregateType: 'CommunicationSetting',
      metadata,
    });
    this.payload = payload;
  }
}
