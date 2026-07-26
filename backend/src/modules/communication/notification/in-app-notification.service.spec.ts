import { Test, TestingModule } from '@nestjs/testing';
import { InAppNotificationService } from './in-app-notification.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { NotificationCategory, NotificationStatus } from '@/generated/client';

describe('InAppNotificationService', () => {
  let service: InAppNotificationService;
  let prismaService: any;
  let eventBus: any;

  beforeEach(async () => {
    prismaService = {
      inAppNotification: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InAppNotificationService,
        { provide: PrismaService, useValue: prismaService },
        { provide: EventBus, useValue: eventBus },
      ],
    }).compile();

    service = module.get<InAppNotificationService>(InAppNotificationService);
  });

  it('should create an in-app notification', async () => {
    const mockNotification = {
      id: 'notif-1',
      userId: 'usr-1',
      title: 'Test Notification',
      content: 'Hello World',
      category: NotificationCategory.SYSTEM,
      status: NotificationStatus.UNREAD,
    };

    prismaService.inAppNotification.create.mockResolvedValue(mockNotification);

    const result = await service.create({
      userId: 'usr-1',
      title: 'Test Notification',
      content: 'Hello World',
    });

    expect(result).toEqual(mockNotification);
    expect(eventBus.publish).toHaveBeenCalled();
  });

  it('should query paginated user notifications', async () => {
    prismaService.inAppNotification.findMany.mockResolvedValue([]);
    prismaService.inAppNotification.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    const result = await service.getUserNotifications('usr-1', {
      page: 1,
      limit: 10,
    });

    expect(result.meta.page).toBe(1);
    expect(result.meta.limit).toBe(10);
    expect(prismaService.inAppNotification.findMany).toHaveBeenCalled();
  });
});
