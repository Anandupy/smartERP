import { Module } from '@nestjs/common';
import { PrismaModule } from '@/infrastructure/database/prisma.module';
import { AuthorizationModule } from '@/modules/authorization/authorization.module';
import { ConfigurationService } from './configuration.service';
import { ConfigurationController } from './configuration.controller';

/**
 * The F2 configuration core. Admission policy is its first consumer; every
 * later module registers its keys in `config.registry.ts`.
 */
@Module({
  imports: [PrismaModule, AuthorizationModule],
  controllers: [ConfigurationController],
  providers: [ConfigurationService],
  exports: [ConfigurationService],
})
export class ConfigurationModule {}
