import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import {
  CommunicationChannel,
  NotificationCategory,
  NotificationPreference,
} from '@/generated/client';
import { UpdateNotificationPreferenceDto } from './dto/update-preference.dto';
import { PreferenceChangedEvent } from '@/common/events/communication.events';

@Injectable()
export class NotificationPreferenceService {
  private readonly logger = new Logger(NotificationPreferenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async getUserPreferences(userId: string): Promise<NotificationPreference[]> {
    const existing = await this.prisma.notificationPreference.findMany({
      where: { userId },
    });

    const categories = Object.values(NotificationCategory);
    const existingMap = new Map(existing.map((p) => [p.category, p]));

    // Fill missing categories with defaults
    return categories.map((cat) => {
      if (existingMap.has(cat)) {
        return existingMap.get(cat)!;
      }
      return {
        id: `default-${userId}-${cat}`,
        userId,
        category: cat,
        emailEnabled: true,
        smsEnabled: true,
        whatsappEnabled: true,
        pushEnabled: true,
        inAppEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });
  }

  async updatePreference(
    userId: string,
    dto: UpdateNotificationPreferenceDto,
  ): Promise<NotificationPreference> {
    const updated = await this.prisma.notificationPreference.upsert({
      where: {
        userId_category: {
          userId,
          category: dto.category,
        },
      },
      update: {
        emailEnabled: dto.emailEnabled,
        smsEnabled: dto.smsEnabled,
        whatsappEnabled: dto.whatsappEnabled,
        pushEnabled: dto.pushEnabled,
        inAppEnabled: dto.inAppEnabled,
      },
      create: {
        userId,
        category: dto.category,
        emailEnabled: dto.emailEnabled ?? true,
        smsEnabled: dto.smsEnabled ?? true,
        whatsappEnabled: dto.whatsappEnabled ?? true,
        pushEnabled: dto.pushEnabled ?? true,
        inAppEnabled: dto.inAppEnabled ?? true,
      },
    });

    await this.eventBus.publish(
      new PreferenceChangedEvent({
        userId: updated.userId,
        category: updated.category,
      }),
    );

    return updated;
  }

  async isChannelAllowed(
    userId: string,
    category: NotificationCategory,
    channel: CommunicationChannel,
  ): Promise<boolean> {
    // Security & Authentication category mandatory channel enforcement
    if (
      category === NotificationCategory.AUTHENTICATION &&
      (channel === CommunicationChannel.EMAIL ||
        channel === CommunicationChannel.SMS)
    ) {
      return true;
    }

    const pref = await this.prisma.notificationPreference.findUnique({
      where: {
        userId_category: { userId, category },
      },
    });

    if (!pref) return true; // Default allowed if no custom preference set

    switch (channel) {
      case CommunicationChannel.EMAIL:
        return pref.emailEnabled;
      case CommunicationChannel.SMS:
        return pref.smsEnabled;
      case CommunicationChannel.WHATSAPP:
        return pref.whatsappEnabled;
      case CommunicationChannel.PUSH:
        return pref.pushEnabled;
      case CommunicationChannel.IN_APP:
        return pref.inAppEnabled;
      default:
        return true;
    }
  }
}
