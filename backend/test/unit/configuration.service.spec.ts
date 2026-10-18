import { ConfigScope } from '@/generated/client';
import { ConfigurationService } from '@/modules/configuration/configuration.service';
import { ADMISSION_CONFIG_KEYS } from '@/modules/configuration/config.registry';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { OutboxPublisher } from '@/infrastructure/outbox/outbox.publisher';
import { AuthorizationService } from '@/modules/authorization/authorization.service';

const KEY = ADMISSION_CONFIG_KEYS.workflowProfile;
const SCOPE = { organizationId: 'org-1', branchId: 'branch-1' };
const BRANCH_TARGET = { scopeType: ConfigScope.BRANCH, scopeId: 'branch-1' };
const ORG_TARGET = { scopeType: ConfigScope.ORGANIZATION, scopeId: 'org-1' };

const row = (scopeType: ConfigScope, value: unknown, version = 1) => ({
  definitionKey: KEY,
  scopeType,
  value,
  version,
  effectiveFrom: new Date('2026-01-01'),
});

describe('ConfigurationService', () => {
  let service: ConfigurationService;
  let prisma: any;
  const hasPermission = jest.fn().mockResolvedValue(true);
  const enqueue = jest.fn();

  beforeEach(() => {
    prisma = {
      configValue: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({ id: 'cv-1' }),
      },
      configDefinition: { upsert: jest.fn() },
      $transaction: jest.fn((cb: any) => cb(prisma)),
    };
    service = new ConfigurationService(
      prisma as PrismaService,
      { enqueue } as unknown as OutboxPublisher,
      { hasPermission } as unknown as AuthorizationService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    hasPermission.mockResolvedValue(true);
  });

  describe('resolution', () => {
    it('falls back to the registry default when nothing is set', async () => {
      const resolved = await service.resolveMany([KEY], SCOPE);
      expect(resolved.get(KEY)).toMatchObject({
        value: 'STANDARD_ADMISSION',
        source: 'DEFAULT',
      });
    });

    it('prefers BRANCH over ORGANIZATION over SYSTEM', async () => {
      prisma.configValue.findMany.mockResolvedValue([
        row(ConfigScope.SYSTEM, 'VERIFIED_ADMISSION'),
        row(ConfigScope.BRANCH, 'SIMPLE_ADMISSION'),
        row(ConfigScope.ORGANIZATION, 'STANDARD_ADMISSION'),
      ]);
      expect((await service.resolveMany([KEY], SCOPE)).get(KEY)).toMatchObject({
        value: 'SIMPLE_ADMISSION',
        source: 'BRANCH',
      });

      prisma.configValue.findMany.mockResolvedValue([
        row(ConfigScope.SYSTEM, 'VERIFIED_ADMISSION'),
        row(ConfigScope.ORGANIZATION, 'SIMPLE_ADMISSION'),
      ]);
      expect((await service.resolveMany([KEY], SCOPE)).get(KEY)).toMatchObject({
        value: 'SIMPLE_ADMISSION',
        source: 'ORGANIZATION',
      });
    });

    it('reads only rows in force at asOf, for this organization and branch', async () => {
      const asOf = new Date('2026-05-01');
      await service.resolveMany([KEY], SCOPE, asOf);

      const where = prisma.configValue.findMany.mock.calls[0][0].where;
      expect(where.effectiveFrom).toEqual({ lte: asOf });
      expect(where.OR).toEqual([
        { effectiveTo: null },
        { effectiveTo: { gt: asOf } },
      ]);
      expect(where.AND[0].OR).toEqual([
        { scopeType: 'SYSTEM', scopeId: null },
        { scopeType: 'ORGANIZATION', scopeId: 'org-1' },
        { scopeType: 'BRANCH', scopeId: 'branch-1' },
      ]);
    });

    it('fails closed on a stored value the registry rejects', async () => {
      prisma.configValue.findMany.mockResolvedValue([
        row(ConfigScope.BRANCH, 'EVERYTHING'),
      ]);
      await expect(service.resolveMany([KEY], SCOPE)).rejects.toMatchObject({
        response: { error: 'CONFIGURATION_INVALID' },
      });
    });

    it('refuses an unknown key', async () => {
      await expect(service.resolveMany(['nope'], SCOPE)).rejects.toMatchObject({
        response: { error: 'CONFIG_KEY_NOT_FOUND' },
      });
    });
  });

  describe('writes', () => {
    const SUPER = { userId: 'u-1', role: 'SUPER_ADMIN' };

    it('closes the current value and opens its successor where it closed', async () => {
      prisma.configValue.findFirst
        .mockResolvedValueOnce({
          id: 'old',
          value: 'STANDARD_ADMISSION',
          effectiveFrom: new Date('2026-01-01'),
        })
        .mockResolvedValueOnce({ version: 3 });

      await service.set(
        KEY,
        BRANCH_TARGET,
        'SIMPLE_ADMISSION',
        'small school',
        SUPER,
      );

      const closedAt =
        prisma.configValue.updateMany.mock.calls[0][0].data.effectiveTo;
      const created = prisma.configValue.create.mock.calls[0][0].data;
      expect(created).toMatchObject({
        definitionKey: KEY,
        scopeType: 'BRANCH',
        scopeId: 'branch-1',
        value: 'SIMPLE_ADMISSION',
        version: 4,
        reason: 'small school',
        setBy: 'u-1',
      });
      expect(created.effectiveFrom).toBe(closedAt);
      expect(enqueue.mock.calls[0][0].payload).toMatchObject({
        key: KEY,
        oldValue: 'STANDARD_ADMISSION',
        newValue: 'SIMPLE_ADMISSION',
      });
    });

    it('never closes a window to zero length', async () => {
      const future = new Date(Date.now() + 60_000);
      prisma.configValue.findFirst
        .mockResolvedValueOnce({ id: 'old', value: 'X', effectiveFrom: future })
        .mockResolvedValueOnce({ version: 1 });

      await service.set(KEY, BRANCH_TARGET, 'SIMPLE_ADMISSION', 'r', SUPER);

      const closedAt: Date =
        prisma.configValue.updateMany.mock.calls[0][0].data.effectiveTo;
      expect(closedAt.getTime()).toBe(future.getTime() + 1);
    });

    it('reports a lost race as a conflict', async () => {
      prisma.configValue.findFirst.mockResolvedValueOnce({
        id: 'old',
        value: 'X',
        effectiveFrom: new Date('2026-01-01'),
      });
      prisma.configValue.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.set(KEY, BRANCH_TARGET, 'SIMPLE_ADMISSION', 'r', SUPER),
      ).rejects.toMatchObject({
        response: { error: 'CONFIG_CONCURRENT_UPDATE' },
      });
    });

    it('requires a reason for a versioned key', async () => {
      await expect(
        service.set(KEY, BRANCH_TARGET, 'SIMPLE_ADMISSION', '  ', SUPER),
      ).rejects.toMatchObject({
        response: { error: 'CONFIG_REASON_REQUIRED' },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('validates the value against the key', async () => {
      await expect(
        service.set(
          ADMISSION_CONFIG_KEYS.offerValidityDays,
          BRANCH_TARGET,
          0,
          'r',
          SUPER,
        ),
      ).rejects.toMatchObject({ response: { error: 'CONFIG_VALUE_INVALID' } });
      await expect(
        service.set(
          ADMISSION_CONFIG_KEYS.waitlistEnabled,
          BRANCH_TARGET,
          'yes',
          'r',
          SUPER,
        ),
      ).rejects.toMatchObject({ response: { error: 'CONFIG_VALUE_INVALID' } });
    });

    it('requires the category permission', async () => {
      hasPermission.mockResolvedValue(false);
      await expect(
        service.set(KEY, BRANCH_TARGET, 'SIMPLE_ADMISSION', 'r', {
          userId: 'u',
          role: 'ORG_ADMIN',
        }),
      ).rejects.toMatchObject({ status: 403 });
      expect(hasPermission).toHaveBeenCalledWith(
        'u',
        'ORG_ADMIN',
        'config.admissions.write',
      );
    });

    it('keeps organization-wide values to organization administrators', async () => {
      await expect(
        service.set(KEY, ORG_TARGET, 'SIMPLE_ADMISSION', 'r', {
          userId: 'u',
          role: 'BRANCH_ADMIN',
        }),
      ).rejects.toMatchObject({ status: 403 });
      expect(hasPermission).not.toHaveBeenCalled();

      await expect(
        service.set(KEY, ORG_TARGET, 'SIMPLE_ADMISSION', 'r', {
          userId: 'u',
          role: 'ORG_ADMIN',
        }),
      ).resolves.toBeDefined();
    });

    it('lets a branch administrator with the permission set their branch', async () => {
      await expect(
        service.set(KEY, BRANCH_TARGET, 'SIMPLE_ADMISSION', 'r', {
          userId: 'u',
          role: 'BRANCH_ADMIN',
        }),
      ).resolves.toBeDefined();
    });

    it('keeps the platform default to super administrators', async () => {
      await expect(
        service.set(
          KEY,
          { scopeType: ConfigScope.SYSTEM, scopeId: null },
          'SIMPLE_ADMISSION',
          'r',
          { userId: 'u', role: 'ORG_ADMIN' },
        ),
      ).rejects.toMatchObject({ status: 403 });
    });

    it('clearing an unset value is a no-op that writes no event', async () => {
      const result = await service.clear(KEY, BRANCH_TARGET, 'r', SUPER);
      expect(result).toEqual({ cleared: false });
      expect(enqueue).not.toHaveBeenCalled();
    });
  });
});
