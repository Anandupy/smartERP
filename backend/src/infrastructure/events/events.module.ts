import { Global, Module } from '@nestjs/common';
import { EventBus } from './event-bus.interface';
import { EventEmitterEventBus } from './adapters/event-emitter.event-bus';

@Global()
@Module({
  providers: [
    {
      provide: EventBus,
      useClass: EventEmitterEventBus,
    },
  ],
  exports: [EventBus],
})
export class EventsModule {}
