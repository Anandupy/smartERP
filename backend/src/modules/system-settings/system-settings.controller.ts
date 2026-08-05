import { Controller, Get, Post, Patch, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SystemSettingsService } from './system-settings.service';
import { CreateSystemDto } from './dto/create-system.dto';
import { UpdateSystemDto } from './dto/update-system.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@/common/enums/role.enum';
import { RequirePermission } from '@/common/decorators/permission.decorator';
import { PERMISSIONS } from '@/common/constants/permission.constants';
import {
  ApiCreatedEnvelope,
  ApiOkEnvelope,
  ApiStandardErrors,
} from '@/common/http/api-envelope-response.decorator';
import { SystemSettingsDto } from './dto/system-settings-response.dto';

@ApiTags('System Settings')
@ApiBearerAuth()
@Controller('system-settings')
@Roles(UserRole.SUPER_ADMIN)
export class SystemSettingsController {
  constructor(private readonly systemSettingsService: SystemSettingsService) {}

  @Post('init')
  @RequirePermission(PERMISSIONS.System.Manage)
  @ApiOperation({
    summary: 'Initialize system settings (allowed only once)',
    description:
      'Creates the singleton configuration record. A second call is rejected with 409.',
  })
  @ApiCreatedEnvelope(SystemSettingsDto, {
    message: 'System settings initialized successfully',
  })
  @ApiStandardErrors(409)
  async init(@Body() dto: CreateSystemDto) {
    const data = await this.systemSettingsService.initSystem(dto);
    return { data, message: 'System settings initialized successfully' };
  }

  @Get()
  @RequirePermission(PERMISSIONS.System.View)
  @ApiOperation({ summary: 'Get global system configuration' })
  @ApiOkEnvelope(SystemSettingsDto, {
    message: 'System settings retrieved successfully',
  })
  @ApiStandardErrors(404)
  async getSettings() {
    const data = await this.systemSettingsService.getSystem();
    return { data, message: 'System settings retrieved successfully' };
  }

  @Patch()
  @RequirePermission(PERMISSIONS.System.Manage)
  @ApiOperation({ summary: 'Update system configuration' })
  @ApiOkEnvelope(SystemSettingsDto, {
    message: 'System settings updated successfully',
  })
  @ApiStandardErrors(404)
  async update(@Body() dto: UpdateSystemDto) {
    const data = await this.systemSettingsService.updateSystem(dto);
    return { data, message: 'System settings updated successfully' };
  }
}
