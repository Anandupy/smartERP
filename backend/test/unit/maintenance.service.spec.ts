import { Test, TestingModule } from '@nestjs/testing';
import { MaintenanceService } from '@/modules/maintenance/maintenance.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { MaintenanceException } from '@/common/filters/maintenance.exception';

describe('MaintenanceService', () => {
  let service: MaintenanceService;
  let prisma: PrismaService;

  const mockEventBus = {
    publish: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn(),
  };

  const mockPrisma = {
    maintenanceRule: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventBus, useValue: mockEventBus },
      ],
    }).compile();

    service = module.get<MaintenanceService>(MaintenanceService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isRuleCurrentlyActive', () => {
    it('should return false if rule.isActive is false', () => {
      const rule = { isActive: false };
      expect(service.isRuleCurrentlyActive(rule, new Date())).toBe(false);
    });

    it('should return true if no startAt/endAt are configured', () => {
      const rule = { isActive: true };
      expect(service.isRuleCurrentlyActive(rule, new Date())).toBe(true);
    });

    it('should return false if current time is before startAt', () => {
      const rule = {
        isActive: true,
        startAt: new Date(Date.now() + 100000),
      };
      expect(service.isRuleCurrentlyActive(rule, new Date())).toBe(false);
    });

    it('should return false if current time is after endAt', () => {
      const rule = {
        isActive: true,
        endAt: new Date(Date.now() - 100000),
      };
      expect(service.isRuleCurrentlyActive(rule, new Date())).toBe(false);
    });

    it('should evaluate recurring weekly windows correctly', () => {
      // Create a Sunday rule (day 0) from 02:00 to 04:00 AM
      const rule = {
        isActive: true,
        isRecurring: true,
        recurrenceDayOfWeek: 0,
        recurrenceStartTime: '02:00',
        recurrenceEndTime: '04:00',
        timezone: 'UTC',
      };

      // A Sunday at 03:00 AM UTC
      const activeTime = new Date('2026-07-26T03:00:00Z'); // July 26, 2026 is a Sunday
      expect(service.isRuleCurrentlyActive(rule, activeTime)).toBe(true);

      // A Sunday at 05:00 AM UTC
      const inactiveTime = new Date('2026-07-26T05:00:00Z');
      expect(service.isRuleCurrentlyActive(rule, inactiveTime)).toBe(false);

      // A Monday at 03:00 AM UTC
      const mondayTime = new Date('2026-07-27T03:00:00Z');
      expect(service.isRuleCurrentlyActive(rule, mondayTime)).toBe(false);
    });
  });

  describe('checkMaintenance precedence resolution', () => {
    it('should resolve rules according to precedence: GLOBAL > ORG > BRANCH > MODULE > FEATURE', async () => {
      // Mock active rules cache
      const mockRules = [
        {
          isActive: true,
          scopeType: 'GLOBAL',
          allowReadApis: false,
          allowWriteApis: false,
          customStatus: 503,
          bypassRoles: [],
        },
        {
          isActive: true,
          scopeType: 'MODULE',
          scopeId: 'academic',
          allowReadApis: true,
          allowWriteApis: false,
          customStatus: 503,
          bypassRoles: [],
        },
      ];

      jest.spyOn(service, 'getActiveRules').mockResolvedValue(mockRules);

      // Check request targeting 'academic' module. Global says both read/write blocked (highest precedence).
      await expect(
        service.checkMaintenance(
          { userId: '1', role: 'STAFF' },
          'GET',
          '/academic-years',
        ),
      ).rejects.toThrow(MaintenanceException);
    });
  });
});
