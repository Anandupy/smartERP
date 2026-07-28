import { Module } from '@nestjs/common';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';
import { NavigationService } from './services/navigation.service';
import { WorkspaceConfigService } from './services/workspace-config.service';
import { AuthorizationModule } from '@/modules/authorization/authorization.module';
import { EventsModule } from '@/infrastructure/events/events.module';

@Module({
  imports: [AuthorizationModule, EventsModule],
  controllers: [WorkspaceController],
  providers: [WorkspaceService, NavigationService, WorkspaceConfigService],
  exports: [WorkspaceService, NavigationService, WorkspaceConfigService],
})
export class WorkspaceModule {}
