import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { InAppNotification, NotificationStatus } from '@/generated/client';
import { CreateInAppNotificationDto } from './dto/create-in-app-notification.dto';
import { QueryNotificationDto } from './dto/query-notification.dto';
import { NotificationCreatedEvent } from '../events/communication.events';

@Injectable()
export class InAppNotificationService {
  private readonly logger = new Logger(InAppNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async create(dto: CreateInAppNotificationDto): Promise<InAppNotification> {
    const notification = await this.prisma.inAppNotification.create({
      data: {
        userId: dto.userId,
        title: dto.title,
        content: dto.content,
        category: dto.category,
        priority: dto.priority,
        actionUrl: dto.actionUrl,
        metadata: dto.metadata,
        isPinned: dto.isPinned || false,
        organizationId: dto.organizationId,
        branchId: dto.branchId,
      },
    });

    await this.eventBus.publish(
      new NotificationCreatedEvent({
        notificationId: notification.id,
        userId: notification.userId,
        title: notification.title,
        category: notification.category,
      }),
    );

    return notification;
  }

  async getUserNotifications(userId: string, query: QueryNotificationDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { userId };

    if (query.status) where.status = query.status;
    if (query.category) where.category = query.category;
    if (query.priority) where.priority = query.priority;
    if (query.isPinned !== undefined) where.isPinned = query.isPinned;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { content: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total, unreadCount] = await Promise.all([
      this.prisma.inAppNotification.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.inAppNotification.count({ where }),
      this.prisma.inAppNotification.count({
        where: { userId, status: NotificationStatus.UNREAD },
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        unreadCount,
      },
    };
  }

  async markAsRead(id: string, userId: string): Promise<InAppNotification> {
    const notification = await this.prisma.inAppNotification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException(
        `Notification with ID '${id}' not found for current user`,
      );
    }

    return this.prisma.inAppNotification.update({
      where: { id },
      data: {
        status: NotificationStatus.READ,
        readAt: new Date(),
      },
    });
  }

  async markAllAsRead(userId: string): Promise<{ count: number }> {
    const result = await this.prisma.inAppNotification.updateMany({
      where: { userId, status: NotificationStatus.UNREAD },
      data: {
        status: NotificationStatus.READ,
        readAt: new Date(),
      },
    });

    return { count: result.count };
  }

  async archiveNotification(
    id: string,
    userId: string,
  ): Promise<InAppNotification> {
    const notification = await this.prisma.inAppNotification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException(
        `Notification with ID '${id}' not found for current user`,
      );
    }

    return this.prisma.inAppNotification.update({
      where: { id },
      data: {
        status: NotificationStatus.ARCHIVED,
        archivedAt: new Date(),
      },
    });
  }
}
