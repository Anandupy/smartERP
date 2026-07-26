import { Controller, Get, Patch, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { NotificationPreferenceService } from './notification-preference.service';
import { UpdateNotificationPreferenceDto } from './dto/update-preference.dto';

@ApiTags('Notification Preferences')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('v1/communication/preferences')
export class NotificationPreferenceController {
  constructor(
    private readonly preferenceService: NotificationPreferenceService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get current user notification preferences' })
  async getMyPreferences(@Req() req: any) {
    return this.preferenceService.getUserPreferences(req.user.id);
  }

  @Patch()
  @ApiOperation({
    summary: 'Update notification category preference for current user',
  })
  async updateMyPreference(
    @Req() req: any,
    @Body() dto: UpdateNotificationPreferenceDto,
  ) {
    return this.preferenceService.updatePreference(req.user.id, dto);
  }
}
