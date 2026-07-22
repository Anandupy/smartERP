import { DomainEvent } from '@/common/events/domain-event.base';

export type EventHandler<T extends DomainEvent = DomainEvent> = (
  event: T,
) => Promise<void> | void;

export abstract class EventBus {
  abstract publish<T extends DomainEvent>(event: T): Promise<void>;
  abstract publishAll<T extends DomainEvent>(events: T[]): Promise<void>;
  abstract subscribe<T extends DomainEvent>(
    eventName: string,
    handler: EventHandler<T>,
  ): void;
  abstract unsubscribe<T extends DomainEvent>(
    eventName: string,
    handler: EventHandler<T>,
  ): void;
}
