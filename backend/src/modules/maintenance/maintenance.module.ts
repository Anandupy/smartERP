import { Module, Global } from '@nestjs/common';
import { PrismaModule } from '@/infrastructure/database/prisma.module';
import { EventsModule } from '@/infrastructure/events/events.module';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceGuard } from '@/common/guards/maintenance.guard';

@Global()
@Module({
  imports: [PrismaModule, EventsModule],
  controllers: [MaintenanceController],
  providers: [MaintenanceService, MaintenanceGuard],
  exports: [MaintenanceService, MaintenanceGuard],
})
export class MaintenanceModule {}
