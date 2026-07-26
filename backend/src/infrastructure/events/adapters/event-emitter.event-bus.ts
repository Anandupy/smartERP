import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import { DomainEvent } from '@/common/events/domain-event.base';
import { EventBus, EventHandler } from '../event-bus.interface';

@Injectable()
export class EventEmitterEventBus implements EventBus {
  private readonly logger = new Logger(EventEmitterEventBus.name);
  private readonly emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100);
  }

  async publish<T extends DomainEvent>(event: T): Promise<void> {
    if (!event || !event.eventName) {
      this.logger.warn('Attempted to publish an invalid domain event');
      return;
    }

    const listeners = this.emitter.listeners(event.eventName);
    if (listeners.length === 0) {
      this.logger.debug(
        `No subscribers registered for event: ${event.eventName}`,
      );
      return;
    }

    const executions = listeners.map(async (listener) => {
      try {
        await (listener as EventHandler<T>)(event);
      } catch (error) {
        this.logger.error(
          `Unhandled error in event handler for "${event.eventName}" (Event ID: ${event.eventId}):`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    });

    await Promise.all(executions);
  }

  async publishAll<T extends DomainEvent>(events: T[]): Promise<void> {
    if (!events || events.length === 0) return;
    await Promise.all(events.map((event) => this.publish(event)));
  }

  subscribe<T extends DomainEvent>(
    eventName: string,
    handler: EventHandler<T>,
  ): void {
    if (!eventName || typeof handler !== 'function') {
      throw new Error('Invalid subscription arguments provided to EventBus');
    }
    this.emitter.on(eventName, handler as (...args: any[]) => void);
    this.logger.debug(`Subscribed handler to event: ${eventName}`);
  }

  unsubscribe<T extends DomainEvent>(
    eventName: string,
    handler: EventHandler<T>,
  ): void {
    if (!eventName || typeof handler !== 'function') return;
    this.emitter.removeListener(eventName, handler as (...args: any[]) => void);
    this.logger.debug(`Unsubscribed handler from event: ${eventName}`);
  }
}
