import { DomainEvent } from './domain-event.base';

export { UserLoggedInEvent } from './examples/user-logged-in.event';

export class UserCreatedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'user.created';
  readonly payload: { userId: string; username: string; email: string; role: string };

  constructor(
    payload: { userId: string; username: string; email: string; role: string },
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: UserCreatedEvent.EVENT_NAME,
      aggregateId: payload.userId,
      aggregateType: 'User',
      metadata,
    });
    this.payload = payload;
  }
}

export class UserUpdatedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'user.updated';
  readonly payload: { userId: string; fullName?: string; role?: string };

  constructor(
    payload: { userId: string; fullName?: string; role?: string },
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: UserUpdatedEvent.EVENT_NAME,
      aggregateId: payload.userId,
      aggregateType: 'User',
      metadata,
    });
    this.payload = payload;
  }
}

export class UserDeletedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'user.deleted';
  readonly payload: { userId: string };

  constructor(
    payload: { userId: string },
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: UserDeletedEvent.EVENT_NAME,
      aggregateId: payload.userId,
      aggregateType: 'User',
      metadata,
    });
    this.payload = payload;
  }
}
