import { DomainEvent } from '../domain-event.base';

export interface UserLoggedInPayload {
  userId: string;
  username: string;
  loginAt: Date;
}

export class UserLoggedInEvent extends DomainEvent {
  static readonly EVENT_NAME = 'user.logged_in';
  readonly payload: UserLoggedInPayload;

  constructor(payload: UserLoggedInPayload, metadata?: Record<string, any>) {
    super({
      eventName: UserLoggedInEvent.EVENT_NAME,
      aggregateId: payload.userId,
      aggregateType: 'User',
      metadata,
    });
    this.payload = payload;
  }
}
