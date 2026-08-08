import { Global, Module } from '@nestjs/common';
import { OutboxPublisher } from './outbox.publisher';
import { OutboxRelay } from './outbox.relay';

/**
 * Durable publication for events that describe committed data.
 *
 * Global because the publisher is called from every module that writes domain
 * data inside a transaction, and injecting it is the *only* thing a business
 * module has to do differently — the relay and the bus are invisible to it.
 */
@Global()
@Module({
  providers: [OutboxPublisher, OutboxRelay],
  exports: [OutboxPublisher, OutboxRelay],
})
export class OutboxModule {}
