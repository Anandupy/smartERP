import { Module } from '@nestjs/common';
import { PrismaModule } from '@/infrastructure/database/prisma.module';
import { WorkspaceSetupService } from './workspace-setup.service';
import { WorkspaceSetupController } from './workspace-setup.controller';

/**
 * Leaf module owning the bootstrap state.
 *
 * It depends only on Prisma, so the context, auth and workspace modules can all
 * consume it without creating a cycle between them.
 */
@Module({
  imports: [PrismaModule],
  controllers: [WorkspaceSetupController],
  providers: [WorkspaceSetupService],
  exports: [WorkspaceSetupService],
})
export class WorkspaceSetupModule {}
