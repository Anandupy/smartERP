import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { CommunicationSetting, ProviderType } from '@/generated/client';
import { UpdateCommunicationConfigDto } from './dto/update-config.dto';
import { ProviderUpdatedEvent } from '@/common/events/communication.events';

@Injectable()
export class CommunicationConfigService {
  private readonly logger = new Logger(CommunicationConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async getConfig(
    organizationId?: string,
    branchId?: string,
  ): Promise<CommunicationSetting> {
    const setting = await this.prisma.communicationSetting.findFirst({
      where: {
        organizationId: organizationId || null,
        branchId: branchId || null,
      },
    });

    if (setting) return setting;

    // Return default settings object if not initialized
    return {
      id: `default-${organizationId || 'global'}-${branchId || 'all'}`,
      organizationId: organizationId || null,
      branchId: branchId || null,
      emailEnabled: true,
      smsEnabled: true,
      whatsappEnabled: true,
      pushEnabled: true,
      otpEnabled: true,
      trackingEnabled: true,
      analyticsEnabled: true,
      retryEnabled: true,
      defaultEmailProvider: ProviderType.SMTP,
      defaultSmsProvider: ProviderType.CUSTOM,
      defaultWhatsappProvider: ProviderType.CUSTOM,
      defaultPushProvider: ProviderType.CUSTOM,
      createdBy: null,
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async updateConfig(
    dto: UpdateCommunicationConfigDto,
    organizationId?: string,
    branchId?: string,
    userId?: string,
  ): Promise<CommunicationSetting> {
    const existing = await this.prisma.communicationSetting.findFirst({
      where: {
        organizationId: organizationId || null,
        branchId: branchId || null,
      },
    });

    let updated: CommunicationSetting;
    if (existing) {
      updated = await this.prisma.communicationSetting.update({
        where: { id: existing.id },
        data: {
          ...dto,
          updatedBy: userId,
        },
      });
    } else {
      updated = await this.prisma.communicationSetting.create({
        data: {
          organizationId: organizationId || null,
          branchId: branchId || null,
          emailEnabled: dto.emailEnabled ?? true,
          smsEnabled: dto.smsEnabled ?? true,
          whatsappEnabled: dto.whatsappEnabled ?? true,
          pushEnabled: dto.pushEnabled ?? true,
          otpEnabled: dto.otpEnabled ?? true,
          trackingEnabled: dto.trackingEnabled ?? true,
          analyticsEnabled: dto.analyticsEnabled ?? true,
          retryEnabled: dto.retryEnabled ?? true,
          defaultEmailProvider: dto.defaultEmailProvider || ProviderType.SMTP,
          defaultSmsProvider: dto.defaultSmsProvider || ProviderType.CUSTOM,
          defaultWhatsappProvider:
            dto.defaultWhatsappProvider || ProviderType.CUSTOM,
          defaultPushProvider: dto.defaultPushProvider || ProviderType.CUSTOM,
          createdBy: userId,
          updatedBy: userId,
        },
      });
    }

    await this.eventBus.publish(
      new ProviderUpdatedEvent({
        organizationId,
        branchId,
        defaultEmailProvider: updated.defaultEmailProvider,
      }),
    );

    return updated;
  }
}
