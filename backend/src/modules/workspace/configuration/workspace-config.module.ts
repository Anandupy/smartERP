import { Module } from '@nestjs/common';
import { WorkspaceConfigService } from './workspace-config.service';

@Module({
  providers: [WorkspaceConfigService],
  exports: [WorkspaceConfigService],
})
export class WorkspaceConfigModule {}
