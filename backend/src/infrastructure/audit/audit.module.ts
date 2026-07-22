import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '@/infrastructure/database/prisma.module';
import { AuditRepository } from './audit.repository';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [AuditRepository],
  exports: [AuditRepository],
})
export class AuditModule {}
