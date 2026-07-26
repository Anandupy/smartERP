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

@ApiTags('In-App Notification Center')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('v1/communication/notifications')
export class InAppNotificationController {
  constructor(private readonly notificationService: InAppNotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user notifications' })
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
  async create(@Body() dto: CreateInAppNotificationDto) {
    return this.notificationService.create(dto);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark notification as read' })
  async markAsRead(@Param('id') id: string, @Req() req: any) {
    return this.notificationService.markAsRead(id, req.user.id);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all user notifications as read' })
  async markAllAsRead(@Req() req: any) {
    return this.notificationService.markAllAsRead(req.user.id);
  }

  @Patch(':id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive a notification' })
  async archive(@Param('id') id: string, @Req() req: any) {
    return this.notificationService.archiveNotification(id, req.user.id);
  }
}
