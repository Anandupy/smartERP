import { Test, TestingModule } from '@nestjs/testing';
import { DeliveryLogService } from './delivery-log.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { CommunicationChannel, DeliveryStatus, ProviderType } from '@/generated/client';

describe('DeliveryLogService', () => {
  let service: DeliveryLogService;
  let prismaService: any;

  beforeEach(async () => {
    prismaService = {
      deliveryLog: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveryLogService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<DeliveryLogService>(DeliveryLogService);
  });

  it('should log a delivery attempt', async () => {
    prismaService.deliveryLog.create.mockImplementation(({ data }: any) => ({
      id: 'log-1',
      ...data,
    }));

    const result = await service.logDelivery({
      channel: CommunicationChannel.EMAIL,
      provider: ProviderType.SMTP,
      recipient: 'user@example.com',
      subject: 'Test Email',
      status: DeliveryStatus.SENT,
      latencyMs: 120,
    });

    expect(result.id).toBe('log-1');
    expect(prismaService.deliveryLog.create).toHaveBeenCalled();
  });

  it('should calculate analytics delivery metrics correctly', async () => {
    prismaService.deliveryLog.count
      .mockResolvedValueOnce(100) // Total
      .mockResolvedValueOnce(70)  // Sent
      .mockResolvedValueOnce(20)  // Delivered
      .mockResolvedValueOnce(8)   // Failed
      .mockResolvedValueOnce(2);  // Bounced

    const stats = await service.getAnalytics();

    expect(stats.total).toBe(100);
    expect(stats.metrics.deliveryRate).toBe(90.0);
    expect(stats.metrics.failureRate).toBe(8.0);
    expect(stats.metrics.bounceRate).toBe(2.0);
  });
});
