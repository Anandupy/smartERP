import { Module } from '@nestjs/common';
import { PrismaModule } from '@/infrastructure/database/prisma.module';
import { EventsModule } from '@/infrastructure/events/events.module';
import { LoggerModule } from '@/common/logger/logger.module';
import { WorkspaceSetupModule } from '@/modules/workspace/setup/workspace-setup.module';
import { ContextDiscoveryService } from './services/context-discovery.service';
import { ContextValidatorService } from './services/context-validator.service';
import { ContextResolverService } from './services/context-resolver.service';
import { ContextService } from './context.service';
import { ExecutionContextGuard } from './guards/execution-context.guard';

@Module({
  imports: [PrismaModule, EventsModule, LoggerModule, WorkspaceSetupModule],
  providers: [
    ContextDiscoveryService,
    ContextValidatorService,
    ContextResolverService,
    ContextService,
    ExecutionContextGuard,
  ],
  exports: [
    ContextDiscoveryService,
    ContextValidatorService,
    ContextResolverService,
    ContextService,
    ExecutionContextGuard,
  ],
})
export class ContextModule {}
