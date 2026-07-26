import { DomainEvent } from './domain-event.base';

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

  constructor(
    payload: PasswordResetRequestedEvent['payload'],
    metadata?: Record<string, any>,
  ) {
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

  constructor(
    payload: PasswordChangedEvent['payload'],
    metadata?: Record<string, any>,
  ) {
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

  constructor(
    payload: EmailVerificationRequestedEvent['payload'],
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: EmailVerificationRequestedEvent.EVENT_NAME,
      aggregateId: payload.userId,
      aggregateType: 'User',
      metadata,
    });
    this.payload = payload;
  }
}

export class EmailVerifiedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'auth.email_verified';
  readonly payload: {
    userId: string;
    email: string;
  };

  constructor(
    payload: EmailVerifiedEvent['payload'],
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: EmailVerifiedEvent.EVENT_NAME,
      aggregateId: payload.userId,
      aggregateType: 'User',
      metadata,
    });
    this.payload = payload;
  }
}

export class OtpResendRequestedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'communication.otp_resend_requested';
  readonly payload: {
    identifier: string;
    purpose: string;
    rawOtp: string;
    email?: string;
    phone?: string;
    userId?: string;
  };

  constructor(
    payload: OtpResendRequestedEvent['payload'],
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: OtpResendRequestedEvent.EVENT_NAME,
      aggregateId: payload.userId || payload.identifier,
      aggregateType: 'User',
      metadata,
    });
    this.payload = payload;
  }
}

export class OtpVerifiedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'communication.otp_verified';
  readonly payload: {
    identifier: string;
    purpose: string;
    userId?: string;
  };

  constructor(
    payload: OtpVerifiedEvent['payload'],
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: OtpVerifiedEvent.EVENT_NAME,
      aggregateId: payload.userId || payload.identifier,
      aggregateType: 'User',
      metadata,
    });
    this.payload = payload;
  }
}

export class OtpSentEvent extends DomainEvent {
  static readonly EVENT_NAME = 'communication.otp_sent';
  readonly payload: {
    identifier: string;
    purpose: string;
    rawOtp: string;
    email?: string;
    phone?: string;
    userId?: string;
  };

  constructor(
    payload: OtpSentEvent['payload'],
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: OtpSentEvent.EVENT_NAME,
      aggregateId: payload.userId || payload.identifier,
      aggregateType: 'User',
      metadata,
    });
    this.payload = payload;
  }
}
