import { Test, TestingModule } from '@nestjs/testing';
import { NotificationPreferenceService } from './notification-preference.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { CommunicationChannel, NotificationCategory } from '@/generated/client';

describe('NotificationPreferenceService', () => {
  let service: NotificationPreferenceService;
  let prismaService: any;
  let eventBus: any;

  beforeEach(async () => {
    prismaService = {
      notificationPreference: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };

    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationPreferenceService,
        { provide: PrismaService, useValue: prismaService },
        { provide: EventBus, useValue: eventBus },
      ],
    }).compile();

    service = module.get<NotificationPreferenceService>(
      NotificationPreferenceService,
    );
  });

  it('should enforce mandatory email/SMS channels for AUTHENTICATION category', async () => {
    const isAllowed = await service.isChannelAllowed(
      'usr-1',
      NotificationCategory.AUTHENTICATION,
      CommunicationChannel.EMAIL,
    );

    expect(isAllowed).toBe(true);
    expect(
      prismaService.notificationPreference.findUnique,
    ).not.toHaveBeenCalled();
  });
});
