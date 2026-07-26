import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { CommunicationChannel, DeliveryLog, DeliveryStatus, ProviderType } from '@/generated/client';
import { QueryDeliveryLogDto } from './dto/query-delivery-log.dto';

export interface CreateDeliveryLogInput {
  channel: CommunicationChannel;
  provider: ProviderType;
  recipient: string;
  sender?: string;
  subject?: string;
  templateId?: string;
  templateVersion?: number;
  status: DeliveryStatus;
  latencyMs?: number;
  retryCount?: number;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
  organizationId?: string;
  branchId?: string;
}

@Injectable()
export class DeliveryLogService {
  private readonly logger = new Logger(DeliveryLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async logDelivery(input: CreateDeliveryLogInput): Promise<DeliveryLog> {
    return this.prisma.deliveryLog.create({
      data: {
        channel: input.channel,
        provider: input.provider,
        recipient: input.recipient,
        sender: input.sender,
        subject: input.subject,
        templateId: input.templateId,
        templateVersion: input.templateVersion,
        status: input.status,
        latencyMs: input.latencyMs,
        retryCount: input.retryCount || 0,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        metadata: input.metadata,
        sentAt: input.status === DeliveryStatus.SENT || input.status === DeliveryStatus.DELIVERED ? new Date() : null,
        deliveredAt: input.status === DeliveryStatus.DELIVERED ? new Date() : null,
        organizationId: input.organizationId,
        branchId: input.branchId,
      },
    });
  }

  async updateStatus(
    id: string,
    status: DeliveryStatus,
    extra?: { errorCode?: string; errorMessage?: string; openedAt?: Date; clickedAt?: Date },
  ): Promise<DeliveryLog> {
    const existing = await this.prisma.deliveryLog.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Delivery log record '${id}' not found`);

    const updateData: any = {
      status,
      errorCode: extra?.errorCode || existing.errorCode,
      errorMessage: extra?.errorMessage || existing.errorMessage,
    };

    if (status === DeliveryStatus.DELIVERED && !existing.deliveredAt) {
      updateData.deliveredAt = new Date();
    }
    if (extra?.openedAt) updateData.openedAt = extra.openedAt;
    if (extra?.clickedAt) updateData.clickedAt = extra.clickedAt;

    return this.prisma.deliveryLog.update({
      where: { id },
      data: updateData,
    });
  }

  async findAll(query: QueryDeliveryLogDto) {
    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.channel) where.channel = query.channel;
    if (query.status) where.status = query.status;
    if (query.provider) where.provider = query.provider;
    if (query.recipient) {
      where.recipient = { contains: query.recipient, mode: 'insensitive' };
    }
    if (query.organizationId) where.organizationId = query.organizationId;
    if (query.branchId) where.branchId = query.branchId;

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const [data, total] = await Promise.all([
      this.prisma.deliveryLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.deliveryLog.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAnalytics(organizationId?: string, branchId?: string) {
    const where: any = {};
    if (organizationId) where.organizationId = organizationId;
    if (branchId) where.branchId = branchId;

    const [total, sent, delivered, failed, bounced] = await Promise.all([
      this.prisma.deliveryLog.count({ where }),
      this.prisma.deliveryLog.count({ where: { ...where, status: DeliveryStatus.SENT } }),
      this.prisma.deliveryLog.count({ where: { ...where, status: DeliveryStatus.DELIVERED } }),
      this.prisma.deliveryLog.count({ where: { ...where, status: DeliveryStatus.FAILED } }),
      this.prisma.deliveryLog.count({ where: { ...where, status: DeliveryStatus.BOUNCED } }),
    ]);

    const totalProcessed = sent + delivered + failed + bounced;
    const deliveryRate = totalProcessed > 0 ? ((sent + delivered) / totalProcessed) * 100 : 100;
    const failureRate = totalProcessed > 0 ? (failed / totalProcessed) * 100 : 0;
    const bounceRate = totalProcessed > 0 ? (bounced / totalProcessed) * 100 : 0;

    return {
      total,
      sent,
      delivered,
      failed,
      bounced,
      metrics: {
        deliveryRate: Number(deliveryRate.toFixed(2)),
        failureRate: Number(failureRate.toFixed(2)),
        bounceRate: Number(bounceRate.toFixed(2)),
      },
    };
  }
}
