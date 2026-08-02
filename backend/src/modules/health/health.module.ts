import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { PrismaModule } from '@/infrastructure/database/prisma.module';
import { HealthController } from './health.controller';
import { PrismaHealthIndicator } from './prisma.health';

@Module({
  imports: [
    TerminusModule.forRoot({
      // The envelope interceptor already shapes responses; terminus should not
      // add a second logger to the boot output.
      logger: false,
    }),
    PrismaModule,
  ],
  controllers: [HealthController],
  providers: [PrismaHealthIndicator],
})
export class HealthModule {}
