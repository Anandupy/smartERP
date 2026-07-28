import { Module } from '@nestjs/common';
import { NavigationModule } from './navigation/navigation.module';
import { WorkspaceConfigModule } from './configuration/workspace-config.module';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';

@Module({
  imports: [NavigationModule, WorkspaceConfigModule],
  controllers: [WorkspaceController],
  providers: [WorkspaceService],
  exports: [WorkspaceService, NavigationModule, WorkspaceConfigModule],
})
export class WorkspaceModule {}
