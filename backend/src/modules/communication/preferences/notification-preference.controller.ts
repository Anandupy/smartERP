import { Controller, Get, Patch, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { NotificationPreferenceService } from './notification-preference.service';
import { UpdateNotificationPreferenceDto } from './dto/update-preference.dto';
import {
  ApiOkEnvelope,
  ApiStandardErrors,
} from '@/common/http/api-envelope-response.decorator';
import { NotificationPreferenceDto } from '../dto/communication-response.dto';

@ApiTags('Notification Preferences')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('communication/preferences')
export class NotificationPreferenceController {
  constructor(
    private readonly preferenceService: NotificationPreferenceService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get current user notification preferences',
    description:
      'Every category is returned. One the user has never changed comes back with all channels enabled and a synthetic id that cannot be used to address it.',
  })
  @ApiOkEnvelope(NotificationPreferenceDto, { isArray: true })
  @ApiStandardErrors()
  async getMyPreferences(@Req() req: any) {
    return this.preferenceService.getUserPreferences(req.user.id);
  }

  @Patch()
  @ApiOperation({
    summary: 'Update notification category preference for current user',
  })
  @ApiOkEnvelope(NotificationPreferenceDto)
  @ApiStandardErrors()
  async updateMyPreference(
    @Req() req: any,
    @Body() dto: UpdateNotificationPreferenceDto,
  ) {
    return this.preferenceService.updatePreference(req.user.id, dto);
  }
}
