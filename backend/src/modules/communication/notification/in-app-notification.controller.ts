import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { InAppNotificationService } from './in-app-notification.service';
import { CreateInAppNotificationDto } from './dto/create-in-app-notification.dto';
import { QueryNotificationDto } from './dto/query-notification.dto';
import {
  ApiCreatedEnvelope,
  ApiOkEnvelope,
  ApiPaginatedEnvelope,
  ApiStandardErrors,
} from '@/common/http/api-envelope-response.decorator';
import {
  InAppNotificationDto,
  NotificationBulkResultDto,
  NotificationMetaDto,
} from '../dto/communication-response.dto';

@ApiTags('In-App Notification Center')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('communication/notifications')
export class InAppNotificationController {
  constructor(private readonly notificationService: InAppNotificationService) {}

  @Get()
  @ApiOperation({
    summary: 'Get current user notifications',
    description:
      'Pagination rides on the envelope’s `meta`, which also carries the user’s whole unread count for the badge.',
  })
  @ApiPaginatedEnvelope(InAppNotificationDto, { meta: NotificationMetaDto })
  @ApiStandardErrors()
  async getMyNotifications(
    @Req() req: any,
    @Query() query: QueryNotificationDto,
  ) {
    return this.notificationService.getUserNotifications(req.user.id, query);
  }

  @Post()
  @ApiOperation({
    summary: 'Create an in-app notification (Admin/Service use)',
  })
  @ApiCreatedEnvelope(InAppNotificationDto)
  @ApiStandardErrors()
  async create(@Body() dto: CreateInAppNotificationDto) {
    return this.notificationService.create(dto);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiOkEnvelope(InAppNotificationDto)
  @ApiStandardErrors(404)
  async markAsRead(@Param('id') id: string, @Req() req: any) {
    return this.notificationService.markAsRead(id, req.user.id);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all user notifications as read' })
  @ApiOkEnvelope(NotificationBulkResultDto)
  @ApiStandardErrors()
  async markAllAsRead(@Req() req: any) {
    return this.notificationService.markAllAsRead(req.user.id);
  }

  @Patch(':id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive a notification' })
  @ApiOkEnvelope(InAppNotificationDto)
  @ApiStandardErrors(404)
  async archive(@Param('id') id: string, @Req() req: any) {
    return this.notificationService.archiveNotification(id, req.user.id);
  }
}
