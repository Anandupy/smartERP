import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { RowLockService } from '@/infrastructure/database/row-lock.service';
import { OutboxPublisher } from '@/infrastructure/outbox/outbox.publisher';
import { ReligionService } from '@/modules/admissions/masters/religion/religion.service';
import { NumberingService } from '@/infrastructure/numbering/numbering.service';
import { ApplicantService } from '@/modules/admissions/applicant/applicant.service';
import { GuardiansService } from '@/modules/admissions/guardians/guardians.service';
import { GuardianshipService } from '@/modules/admissions/guardians/guardianship.service';
import { PersonService } from '@/modules/identity/person/person.service';
import { AuthorizationService } from '@/modules/authorization/authorization.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { ResourceScope } from '@/common/scope/resource-scope';
import {
  ApplicantCreatedEvent,
  NumberingConfigCreatedEvent,
} from '@/common/events';

/**
 * The scope every service call now carries.
 *
 * Passing it explicitly is the point of the Phase 0 change: a service can no
 * longer be handed a bare id and left to decide for itself whether the caller
 * was entitled to it.
 */
const SCOPE: ResourceScope = {
  organizationId: 'org-1',
  branchId: 'branch-1',
  academicYearId: 'year-1',
};

const OTHER_BRANCH_SCOPE: ResourceScope = {
  organizationId: 'org-1',
  branchId: 'branch-2',
  academicYearId: 'year-1',
};

describe('Admissions Module Foundation - Unit Tests', () => {
  let religionService: ReligionService;
  let numberingService: NumberingService;
  let applicantService: ApplicantService;
  let guardiansService: GuardiansService;

  const mockEventBus = {
    publish: jest.fn().mockResolvedValue(undefined),
    publishAll: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
  };

  /**
   * Routes a raw query to the right canned answer.
   *
   * Two very different statements go through `$queryRawUnsafe` now — the
   * numbering upsert and the row lock — so the mock has to tell them apart.
   *
   * Reinstalled in `beforeEach`, because a test that swaps the implementation
   * to observe call ordering would otherwise leave the router replaced for
   * every test after it.
   */
  const rawQuery = jest.fn() as jest.Mock & { lockResult: unknown[] };
  rawQuery.lockResult = [];

  const routeRawQuery = (sql: string) => {
    if (sql.includes('NumberSequenceCounter')) {
      return Promise.resolve([{ currentValue: 1 }]);
    }
    if (sql.includes('FOR UPDATE')) {
      return Promise.resolve(rawQuery.lockResult);
    }
    return Promise.resolve([]);
  };

  const mockPersons = {
    resolve: jest.fn(),
    reconcileGovernmentId: jest.fn().mockResolvedValue(undefined),
  };

  const mockAuthorization = {
    hasPermission: jest.fn().mockResolvedValue(true),
  };

  /** The identity check's own refusal, as `PersonService` raises it. */
  const mismatch = () =>
    new ConflictException({
      error: 'GOVERNMENT_ID_MISMATCH',
      message:
        'Aadhaar number does not match the existing identity record. Please verify the details.',
      field: 'aadhaarNo',
    });

  const mockPrisma: any = {
    religion: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    gender: { findFirst: jest.fn() },
    caste: { findFirst: jest.fn() },
    category: { findFirst: jest.fn() },
    language: { findFirst: jest.fn() },
    bloodGroup: { findFirst: jest.fn() },
    disability: { findFirst: jest.fn() },
    admissionSource: { findFirst: jest.fn() },
    quota: { findFirst: jest.fn() },
    numberSequenceConfig: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    numberSequenceCounter: { findFirst: jest.fn(), create: jest.fn() },
    branch: { findUnique: jest.fn() },
    academicYear: { findUnique: jest.fn(), findFirst: jest.fn() },
    program: { findUnique: jest.fn(), findFirst: jest.fn() },
    academicUnit: { findUnique: jest.fn(), findFirst: jest.fn() },
    applicant: {
      findFirst: jest.fn(),
      findFirstOrThrow: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    guardian: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findFirstOrThrow: jest.fn(),
    },
    relationType: { findFirst: jest.fn() },
    applicantGuardianMapping: {
      upsert: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    enrollment: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    workflowHistory: { create: jest.fn(), findMany: jest.fn() },
    outboxEvent: { create: jest.fn().mockResolvedValue({ id: 'outbox-1' }) },
    $transaction: jest.fn((cb: any) => cb(mockPrisma)),
    $queryRawUnsafe: rawQuery,
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    rawQuery.mockImplementation(routeRawQuery);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReligionService,
        NumberingService,
        ApplicantService,
        GuardiansService,
        // Real instances rather than mocks: both are thin, and using the real
        // ones means these tests exercise the locking and outbox wiring instead
        // of asserting against a stand-in that cannot be wrong.
        RowLockService,
        OutboxPublisher,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventBus, useValue: mockEventBus },
        { provide: PersonService, useValue: mockPersons },
        { provide: AuthorizationService, useValue: mockAuthorization },
        {
          provide: GuardianshipService,
          useValue: {
            syncOne: jest.fn(),
            syncFromApplicantMappings: jest.fn(),
          },
        },
      ],
    }).compile();

    religionService = module.get(ReligionService);
    numberingService = module.get(NumberingService);
    applicantService = module.get(ApplicantService);
    guardiansService = module.get(GuardiansService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    rawQuery.lockResult = [];
  });

  describe('Master Data uniqueness', () => {
    it('rejects a master whose code already exists in scope', async () => {
      mockPrisma.religion.findFirst.mockResolvedValueOnce({ id: 'existing' });
      await expect(
        religionService.create({ code: 'HIND', name: 'Hindu' }, SCOPE),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects a master whose name already exists in scope', async () => {
      mockPrisma.religion.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'existing' });
      await expect(
        religionService.create({ code: 'HIND', name: 'Hindu' }, SCOPE),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Numbering', () => {
    const config = {
      id: 'cfg-1',
      purpose: 'ADMISSION_FORM',
      prefix: 'ADM',
      suffix: null,
      includeBranchCode: true,
      includeAcademicYear: true,
      sequencePadding: 4,
      format: '{prefix}-{branchCode}-{year}-{sequence}',
      resetStrategy: 'YEARLY',
      allocationMode: 'MONOTONIC',
      scope: 'BRANCH',
      branchId: 'branch-1',
    };

    it('renders a value from the configured format', async () => {
      mockPrisma.numberSequenceConfig.findFirst.mockResolvedValue(config);
      mockPrisma.branch.findUnique.mockResolvedValue({ code: 'MUM' });
      mockPrisma.academicYear.findUnique.mockResolvedValue({ name: '2026' });

      const value = await numberingService.allocate(
        {
          purpose: 'ADMISSION_FORM',
          organizationId: 'org-1',
          branchId: 'branch-1',
          academicYearId: 'year-1',
        },
        mockPrisma,
      );

      expect(value).toBe('ADM-MUM-2026-0001');
    });

    it('resolves placeholders before touching the counter', async () => {
      const calls: string[] = [];
      mockPrisma.numberSequenceConfig.findFirst.mockResolvedValue(config);
      mockPrisma.branch.findUnique.mockImplementation(() => {
        calls.push('branch');
        return Promise.resolve({ code: 'MUM' });
      });
      mockPrisma.academicYear.findUnique.mockImplementation(() => {
        calls.push('year');
        return Promise.resolve({ name: '2026' });
      });
      rawQuery.mockImplementation((sql: string) => {
        if (sql.includes('NumberSequenceCounter')) {
          calls.push('increment');
          return Promise.resolve([{ currentValue: 1 }]);
        }
        return Promise.resolve([]);
      });

      await numberingService.allocate(
        {
          purpose: 'ADMISSION_FORM',
          organizationId: 'org-1',
          branchId: 'branch-1',
          academicYearId: 'year-1',
        },
        mockPrisma,
      );

      // Any lookup between the increment and the caller's commit is lock-hold
      // time on a row every concurrent allocation is queued behind.
      expect(calls).toEqual(['branch', 'year', 'increment']);
    });

    it('allocates in a single upsert rather than find-then-create', async () => {
      mockPrisma.numberSequenceConfig.findFirst.mockResolvedValue({
        ...config,
        includeBranchCode: false,
        includeAcademicYear: false,
        format: '{prefix}{sequence}',
      });

      await numberingService.allocate(
        {
          purpose: 'ADMISSION_FORM',
          organizationId: 'org-1',
          branchId: 'branch-1',
          academicYearId: 'year-1',
        },
        mockPrisma,
      );

      const sql = rawQuery.mock.calls[0][0] as string;
      expect(sql).toContain('ON CONFLICT');
      expect(sql).toContain('COALESCE');
      // The find-then-create it replaces could not survive a unique violation
      // inside a transaction: Postgres aborts, and the recovery read fails.
      expect(mockPrisma.numberSequenceCounter.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.numberSequenceCounter.create).not.toHaveBeenCalled();
    });

    it('fails loudly when a sequence is not provisioned', async () => {
      mockPrisma.numberSequenceConfig.findFirst.mockResolvedValue(null);

      await expect(
        numberingService.allocate(
          {
            purpose: 'STUDENT_CODE',
            organizationId: 'org-1',
            branchId: 'branch-1',
          },
          mockPrisma,
        ),
      ).rejects.toMatchObject({
        response: { error: 'NUMBERING_NOT_PROVISIONED' },
      });

      // Inventing a config on the fly is how a tenant silently acquires a
      // numbering scheme nobody chose.
      expect(mockPrisma.numberSequenceConfig.create).not.toHaveBeenCalled();
    });

    it('rejects a format that renders no counter', async () => {
      await expect(
        numberingService.createConfig(
          { purpose: 'STUDENT_CODE', prefix: 'STU', format: '{prefix}-{year}' },
          'org-1',
          null,
        ),
      ).rejects.toMatchObject({
        response: { error: 'NUMBERING_FORMAT_INVALID' },
      });
    });

    it('derives scope, reset and allocation mode from the purpose', async () => {
      mockPrisma.numberSequenceConfig.findFirst.mockResolvedValue(null);
      mockPrisma.numberSequenceConfig.create.mockResolvedValue({
        id: 'cfg-2',
        purpose: 'STUDENT_CODE',
        format: '{prefix}{sequence}',
      });

      await numberingService.createConfig(
        {
          purpose: 'STUDENT_CODE',
          prefix: 'STU',
          sequencePadding: 10,
          format: '{prefix}{sequence}',
        },
        'org-1',
        'branch-1',
      );

      const data = mockPrisma.numberSequenceConfig.create.mock.calls[0][0].data;
      expect(data.scope).toBe('ORGANIZATION');
      expect(data.resetStrategy).toBe('NEVER');
      expect(data.allocationMode).toBe('MONOTONIC');
      // An organization-scoped sequence is not pinned to whichever branch the
      // administrator happened to have selected.
      expect(data.branchId).toBeNull();
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.any(NumberingConfigCreatedEvent),
      );
    });

    it('freezes prefix and padding once an identity sequence has issued a value', async () => {
      mockPrisma.numberSequenceConfig.findFirst.mockResolvedValue({
        id: 'cfg-2',
        purpose: 'STUDENT_CODE',
        resetStrategy: 'NEVER',
        prefix: 'STU',
        sequencePadding: 10,
      });
      mockPrisma.numberSequenceCounter.findFirst.mockResolvedValue({
        id: 'cnt-1',
      });

      await expect(
        numberingService.updateConfig('cfg-2', { sequencePadding: 8 }, 'org-1'),
      ).rejects.toMatchObject({
        response: { error: 'SEQUENCE_WIDTH_IMMUTABLE' },
      });
    });

    it('allows width changes before the first allocation', async () => {
      mockPrisma.numberSequenceConfig.findFirst.mockResolvedValue({
        id: 'cfg-2',
        purpose: 'STUDENT_CODE',
        resetStrategy: 'NEVER',
        prefix: 'STU',
        sequencePadding: 10,
      });
      mockPrisma.numberSequenceCounter.findFirst.mockResolvedValue(null);
      mockPrisma.numberSequenceConfig.update.mockResolvedValue({ id: 'cfg-2' });

      await expect(
        numberingService.updateConfig('cfg-2', { sequencePadding: 8 }, 'org-1'),
      ).resolves.toBeDefined();
    });
  });

  describe('Applicant', () => {
    const dto = {
      firstName: 'John',
      lastName: 'Doe',
      dob: '2020-01-01',
      genderId: 'gen-1',
      primaryMobile: '9999999999',
      currentAddressLine1: 'Street 1',
      city: 'Mumbai',
      state: 'MH',
      country: 'IN',
      pincode: '400001',
    } as any;

    it('creates the applicant and its numbers in one transaction, and outboxes the event', async () => {
      mockPrisma.gender.findFirst.mockResolvedValue({ id: 'gen-1' });
      mockPrisma.numberSequenceConfig.findFirst.mockResolvedValue({
        id: 'cfg-1',
        format: '{prefix}{sequence}',
        prefix: 'ADM',
        suffix: null,
        sequencePadding: 4,
        resetStrategy: 'YEARLY',
        allocationMode: 'MONOTONIC',
        includeBranchCode: false,
        includeAcademicYear: false,
      });
      mockPrisma.applicant.findMany.mockResolvedValue([
        { id: 'app-old', displayName: 'John Doe', primaryMobile: '9999999999' },
      ]);
      mockPrisma.applicant.create.mockResolvedValue({
        id: 'app-new',
        displayName: 'John Doe',
        admissionFormNo: 'ADM0001',
        applicationNo: 'APP0001',
        primaryMobile: '9999999999',
      });

      const result = await applicantService.create(dto, SCOPE);

      expect(result.applicant.id).toBe('app-new');
      expect(result.warnings.length).toBe(1);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      // Durability, not fire-and-forget: the event commits with the row.
      expect(mockPrisma.outboxEvent.create).toHaveBeenCalled();
      const outboxed = mockPrisma.outboxEvent.create.mock.calls[0][0].data;
      expect(outboxed.eventName).toBe(ApplicantCreatedEvent.EVENT_NAME);
    });

    it('confines a read to the caller scope', async () => {
      mockPrisma.applicant.findFirst.mockResolvedValue(null);

      await expect(applicantService.findOne('app-1', SCOPE)).rejects.toThrow(
        NotFoundException,
      );

      expect(
        mockPrisma.applicant.findFirst.mock.calls[0][0].where,
      ).toMatchObject({
        id: 'app-1',
        organizationId: 'org-1',
        branchId: 'branch-1',
        deletedAt: null,
      });
    });

    it('re-asserts the scope on the write, not only on the preceding read', async () => {
      mockPrisma.applicant.findFirst.mockResolvedValue({
        id: 'app-1',
        admissionStatus: 'DRAFT',
        firstName: 'John',
        middleName: null,
        lastName: 'Doe',
      });
      mockPrisma.applicant.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.applicant.findFirstOrThrow.mockResolvedValue({
        id: 'app-1',
        displayName: 'Johnny Doe',
      });

      await applicantService.update(
        'app-1',
        { firstName: 'Johnny' } as any,
        SCOPE,
      );

      expect(
        mockPrisma.applicant.updateMany.mock.calls[0][0].where,
      ).toMatchObject({
        id: 'app-1',
        organizationId: 'org-1',
        branchId: 'branch-1',
      });
    });

    it('refuses to edit an applicant that has been offered a seat', async () => {
      mockPrisma.applicant.findFirst.mockResolvedValue({
        id: 'app-1',
        admissionStatus: 'APPROVED',
      });

      await expect(
        applicantService.update('app-1', { firstName: 'X' } as any, SCOPE),
      ).rejects.toThrow(ForbiddenException);
    });

    describe('Aadhaar on an edit', () => {
      // Synthetic, format-valid, never issued.
      const OTHER = '345678901234';

      beforeEach(() => {
        mockPrisma.applicant.findFirst.mockResolvedValue({
          id: 'app-1',
          admissionStatus: 'SUBMITTED',
          firstName: 'John',
          lastName: 'Doe',
        });
        mockPrisma.applicant.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.applicant.findFirstOrThrow.mockResolvedValue({
          id: 'app-1',
          displayName: 'John Doe',
        });
      });

      it('checks it against the identity read under the row lock', async () => {
        rawQuery.lockResult = [{ id: 'app-1', personId: 'person-1' }];

        await applicantService.update(
          'app-1',
          { aadhaarNo: OTHER } as any,
          SCOPE,
        );

        const lockSql = rawQuery.mock.calls.find(([sql]) =>
          String(sql).includes('FOR UPDATE'),
        );
        expect(lockSql?.[0]).toContain('"Applicant"');
        expect(mockPersons.reconcileGovernmentId).toHaveBeenCalledWith(
          'org-1',
          'person-1',
          OTHER,
          expect.objectContaining({ field: 'aadhaarNo' }),
          mockPrisma,
        );
        // Checked before the write, inside the same transaction.
        expect(
          mockPersons.reconcileGovernmentId.mock.invocationCallOrder[0],
        ).toBeLessThan(
          mockPrisma.applicant.updateMany.mock.invocationCallOrder[0],
        );
      });

      it('asks whether the caller may attach a first Aadhaar, and only when the identity needs one', async () => {
        rawQuery.lockResult = [{ id: 'app-1', personId: 'person-1' }];

        await applicantService.update(
          'app-1',
          { aadhaarNo: OTHER } as any,
          SCOPE,
          'user-1',
          'BRANCH_ADMIN',
        );

        // Lazy: nothing is asked until the identity turns out to have none.
        expect(mockAuthorization.hasPermission).not.toHaveBeenCalled();
        const { mayAttach } =
          mockPersons.reconcileGovernmentId.mock.calls[0][3];
        await expect(mayAttach()).resolves.toBe(true);
        expect(mockAuthorization.hasPermission).toHaveBeenCalledWith(
          'user-1',
          'BRANCH_ADMIN',
          'person.attach_government_id',
        );
      });

      it('never lets an anonymous caller attach', async () => {
        rawQuery.lockResult = [{ id: 'app-1', personId: 'person-1' }];

        await applicantService.update(
          'app-1',
          { aadhaarNo: OTHER } as any,
          SCOPE,
        );

        const { mayAttach } =
          mockPersons.reconcileGovernmentId.mock.calls[0][3];
        await expect(mayAttach()).resolves.toBe(false);
        expect(mockAuthorization.hasPermission).not.toHaveBeenCalled();
      });

      it('writes nothing and emits nothing when the identity disagrees', async () => {
        rawQuery.lockResult = [{ id: 'app-1', personId: 'person-1' }];
        mockPersons.reconcileGovernmentId.mockRejectedValueOnce(mismatch());

        await expect(
          applicantService.update('app-1', { aadhaarNo: OTHER } as any, SCOPE),
        ).rejects.toMatchObject({
          status: 409,
          response: { error: 'GOVERNMENT_ID_MISMATCH', field: 'aadhaarNo' },
        });

        expect(mockPrisma.applicant.updateMany).not.toHaveBeenCalled();
        expect(mockPrisma.outboxEvent.create).not.toHaveBeenCalled();
      });

      it('has nothing to compare for an application with no identity yet', async () => {
        rawQuery.lockResult = [{ id: 'app-1', personId: null }];

        await applicantService.update(
          'app-1',
          { aadhaarNo: OTHER } as any,
          SCOPE,
        );

        expect(mockPersons.reconcileGovernmentId).not.toHaveBeenCalled();
        expect(mockPrisma.applicant.updateMany).toHaveBeenCalled();
      });

      it('takes no lock and makes no check for an edit that leaves Aadhaar alone', async () => {
        await applicantService.update(
          'app-1',
          { firstName: 'Johnny' } as any,
          SCOPE,
        );

        expect(mockPersons.reconcileGovernmentId).not.toHaveBeenCalled();
        expect(
          rawQuery.mock.calls.some(([sql]) =>
            String(sql).includes('FOR UPDATE'),
          ),
        ).toBe(false);
      });
    });

    describe('deleting', () => {
      it('soft-deletes a draft, with the status part of the write', async () => {
        mockPrisma.applicant.findFirst.mockResolvedValue({
          id: 'app-1',
          admissionStatus: 'DRAFT',
        });
        mockPrisma.applicant.updateMany.mockResolvedValue({ count: 1 });

        await expect(
          applicantService.remove('app-1', SCOPE, 'user-1'),
        ).resolves.toEqual({ id: 'app-1' });

        const write = mockPrisma.applicant.updateMany.mock.calls[0][0];
        expect(write.where).toMatchObject({
          id: 'app-1',
          organizationId: 'org-1',
          branchId: 'branch-1',
          deletedAt: null,
          admissionStatus: 'DRAFT',
        });
        expect(write.data).toMatchObject({
          deletedAt: expect.any(Date),
          updatedBy: 'user-1',
        });
        const outboxed = mockPrisma.outboxEvent.create.mock.calls[0][0].data;
        expect(outboxed.eventName).toBe('applicant.deleted');
      });

      it.each([
        'SUBMITTED',
        'UNDER_REVIEW',
        'WAITLISTED',
        'SEAT_CONFIRMED',
        'CANCELLED',
        'ADMITTED',
      ])('refuses an application in %s without touching it', async (status) => {
        mockPrisma.applicant.findFirst.mockResolvedValue({
          id: 'app-1',
          admissionStatus: status,
        });

        await expect(
          applicantService.remove('app-1', SCOPE),
        ).rejects.toMatchObject({
          status: 403,
          response: { error: 'APPLICANT_NOT_DELETABLE', status },
        });
        expect(mockPrisma.applicant.updateMany).not.toHaveBeenCalled();
        expect(mockPrisma.outboxEvent.create).not.toHaveBeenCalled();
      });

      it('refuses a draft submitted between the read and the write', async () => {
        mockPrisma.applicant.findFirst
          .mockResolvedValueOnce({ id: 'app-1', admissionStatus: 'DRAFT' })
          .mockResolvedValueOnce({ admissionStatus: 'SUBMITTED' });
        mockPrisma.applicant.updateMany.mockResolvedValue({ count: 0 });

        await expect(
          applicantService.remove('app-1', SCOPE),
        ).rejects.toMatchObject({
          response: { error: 'APPLICANT_NOT_DELETABLE', status: 'SUBMITTED' },
        });
        expect(mockPrisma.outboxEvent.create).not.toHaveBeenCalled();
      });

      it('answers 404 for a draft deleted between the read and the write', async () => {
        mockPrisma.applicant.findFirst
          .mockResolvedValueOnce({ id: 'app-1', admissionStatus: 'DRAFT' })
          .mockResolvedValueOnce(null);
        mockPrisma.applicant.updateMany.mockResolvedValue({ count: 0 });

        await expect(
          applicantService.remove('app-1', SCOPE),
        ).rejects.toBeInstanceOf(NotFoundException);
      });

      it("cannot reach another branch's draft", async () => {
        mockPrisma.applicant.findFirst.mockResolvedValue(null);

        await expect(
          applicantService.remove('app-1', OTHER_BRANCH_SCOPE),
        ).rejects.toBeInstanceOf(NotFoundException);
        expect(
          mockPrisma.applicant.findFirst.mock.calls[0][0].where,
        ).toMatchObject({ branchId: 'branch-2' });
        expect(mockPrisma.applicant.updateMany).not.toHaveBeenCalled();
      });
    });
  });

  describe('Guardian Aadhaar on an edit', () => {
    const OTHER = '345678901234';
    const guardianRow = (personId: string | null) => ({
      id: 'g-1',
      personId,
      firstName: 'Anil',
      middleName: null,
      lastName: 'Sharma',
      mobilePrimary: '9999999999',
      aadhaarNo: '234567890123',
    });

    beforeEach(() => {
      mockPrisma.guardian.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.guardian.findFirstOrThrow.mockResolvedValue(guardianRow(null));
    });

    it('locks the guardian and checks a linked one against its identity', async () => {
      mockPrisma.guardian.findFirst.mockResolvedValue(guardianRow('person-9'));

      await guardiansService.update('g-1', { aadhaarNo: OTHER } as any, SCOPE);

      const lockSql = rawQuery.mock.calls.find(([sql]) =>
        String(sql).includes('FOR UPDATE'),
      );
      expect(lockSql?.[0]).toContain('"Guardian"');
      expect(mockPersons.reconcileGovernmentId).toHaveBeenCalledWith(
        'org-1',
        'person-9',
        OTHER,
        expect.objectContaining({ field: 'aadhaarNo' }),
        mockPrisma,
      );
    });

    it("passes the caller's own permission check for a first Aadhaar", async () => {
      mockPrisma.guardian.findFirst.mockResolvedValue(guardianRow('person-9'));

      await guardiansService.update('g-1', { aadhaarNo: OTHER } as any, SCOPE, {
        userId: 'user-7',
        role: 'ORG_ADMIN',
      });

      const { mayAttach } = mockPersons.reconcileGovernmentId.mock.calls[0][3];
      await mayAttach();
      expect(mockAuthorization.hasPermission).toHaveBeenCalledWith(
        'user-7',
        'ORG_ADMIN',
        'person.attach_government_id',
      );
    });

    it('writes nothing when the identity disagrees', async () => {
      mockPrisma.guardian.findFirst.mockResolvedValue(guardianRow('person-9'));
      mockPersons.reconcileGovernmentId.mockRejectedValueOnce(mismatch());

      await expect(
        guardiansService.update('g-1', { aadhaarNo: OTHER } as any, SCOPE),
      ).rejects.toMatchObject({
        response: { error: 'GOVERNMENT_ID_MISMATCH' },
      });
      expect(mockPrisma.guardian.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.outboxEvent.create).not.toHaveBeenCalled();
    });

    it('has nothing to compare for an unlinked guardian', async () => {
      mockPrisma.guardian.findFirst.mockResolvedValue(guardianRow(null));

      await guardiansService.update('g-1', { aadhaarNo: OTHER } as any, SCOPE);

      expect(mockPersons.reconcileGovernmentId).not.toHaveBeenCalled();
      expect(mockPrisma.guardian.updateMany).toHaveBeenCalled();
    });
  });

  describe('Guardian mapping', () => {
    it('clears the previous primary before setting a new one', async () => {
      mockPrisma.applicant.findFirst.mockResolvedValue({
        id: 'app-1',
        admissionStatus: 'DRAFT',
        organizationId: SCOPE.organizationId,
        branchId: SCOPE.branchId,
      });
      mockPrisma.guardian.findFirst.mockResolvedValue({
        id: 'guard-1',
        organizationId: SCOPE.organizationId,
        branchId: SCOPE.branchId,
      });
      mockPrisma.relationType.findFirst.mockResolvedValue({ id: 'rel-1' });
      mockPrisma.applicantGuardianMapping.upsert.mockResolvedValue({
        applicantId: 'app-1',
        guardianId: 'guard-1',
        relationTypeId: 'rel-1',
        isPrimary: true,
      });

      await guardiansService.mapGuardianToApplicant(
        'app-1',
        {
          guardianId: 'guard-1',
          relationTypeId: 'rel-1',
          isPrimary: true,
        },
        SCOPE,
      );

      expect(
        mockPrisma.applicantGuardianMapping.updateMany,
      ).toHaveBeenCalledWith({
        where: { applicantId: 'app-1', isPrimary: true },
        data: { isPrimary: false },
      });
      expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventName: 'guardian.mapped' }),
        }),
      );
    });

    it('rejects mapping a guardian from another tenant with 404, not the cross-tenant row', async () => {
      mockPrisma.applicant.findFirst.mockResolvedValue({
        id: 'app-1',
        admissionStatus: 'DRAFT',
        organizationId: SCOPE.organizationId,
        branchId: SCOPE.branchId,
      });
      // Scoped findFirst would return null for a guardian outside this scope.
      mockPrisma.guardian.findFirst.mockResolvedValue(null);

      await expect(
        guardiansService.mapGuardianToApplicant(
          'app-1',
          { guardianId: 'guard-other-tenant', relationTypeId: 'rel-1' },
          SCOPE,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.applicantGuardianMapping.upsert).not.toHaveBeenCalled();
    });
  });
});
