import { Controller, Get, Post, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { SystemSettingsService } from './system-settings.service';
import { CreateSystemDto } from './dto/create-system.dto';
import { UpdateSystemDto } from './dto/update-system.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { UserRole } from '@/common/enums/role.enum';

@ApiTags('System Settings')
@ApiHeader({
  name: 'x-role',
  description: 'User role for simulation',
  required: true,
})
@Controller('system-settings')
@UseGuards(RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class SystemSettingsController {
  constructor(private readonly systemSettingsService: SystemSettingsService) {}

  @Post('init')
  @ApiOperation({ summary: 'Initialize system settings (allowed only once)' })
  async init(@Body() dto: CreateSystemDto) {
    const data = await this.systemSettingsService.initSystem(dto);
    return { data, message: 'System settings initialized successfully' };
  }

  @Get()
  @ApiOperation({ summary: 'Get global system configuration' })
  async getSettings() {
    const data = await this.systemSettingsService.getSystem();
    return { data, message: 'System settings retrieved successfully' };
  }

  @Patch()
  @ApiOperation({ summary: 'Update system configuration' })
  async update(@Body() dto: UpdateSystemDto) {
    const data = await this.systemSettingsService.updateSystem(dto);
    return { data, message: 'System settings updated successfully' };
  }
}
