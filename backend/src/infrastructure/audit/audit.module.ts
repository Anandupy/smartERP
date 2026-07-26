import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '@/infrastructure/database/prisma.module';
import { EventsModule } from '@/infrastructure/events/events.module';
import { AuditRepository } from './audit.repository';
import { AuditEventMapper } from './audit-event.mapper';
import { AuditListener } from './audit.listener';
import { AuditController } from './audit.controller';

@Global()
@Module({
  imports: [PrismaModule, EventsModule],
  controllers: [AuditController],
  providers: [AuditRepository, AuditEventMapper, AuditListener],
  exports: [AuditRepository, AuditEventMapper, AuditListener],
})
export class AuditModule {}
