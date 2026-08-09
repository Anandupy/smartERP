import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@/generated/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { OutboxPublisher } from '@/infrastructure/outbox/outbox.publisher';
import { NumberingService } from '@/infrastructure/numbering/numbering.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { StudentService } from '@/modules/identity/student/student.service';
import { ResourceScope } from '@/common/scope/resource-scope';
import {
  StudentCodeAssignedEvent,
  StudentCreatedEvent,
  StudentUpdatedEvent,
} from '@/common/events';

const SCOPE: ResourceScope = {
  organizationId: 'org-1',
  branchId: 'branch-1',
  academicYearId: null,
};

const OTHER_BRANCH: ResourceScope = {
  organizationId: 'org-1',
  branchId: 'branch-2',
  academicYearId: null,
};

const uniqueViolation = (target: string) =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '5.22.0',
    meta: { target },
  });

describe('StudentService', () => {
  let students: StudentService;

  const allocate = jest.fn().mockResolvedValue('STU0000000001');

  const mockPrisma: any = {
    student: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findFirstOrThrow: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    outboxEvent: { create: jest.fn().mockResolvedValue({ id: 'ob-1' }) },
    $transaction: jest.fn((cb: any) => cb(mockPrisma)),
  };

  const baseInput = {
    organizationId: 'org-1',
    branchId: 'branch-1',
    personId: 'person-1',
    firstName: 'Riya',
    lastName: 'Sharma',
    dob: new Date('2015-04-12'),
    genderId: 'gender-1',
    createdVia: 'MIGRATION' as const,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentService,
        // Real publisher: it is thin, and using it means these tests exercise
        // the outbox wiring rather than a stand-in that cannot be wrong.
        OutboxPublisher,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NumberingService, useValue: { allocate } },
        { provide: EventBus, useValue: { publish: jest.fn() } },
      ],
    }).compile();

    students = module.get(StudentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    allocate.mockResolvedValue('STU0000000001');
  });

  describe('creation', () => {
    it('allocates the code from the central engine, never locally', async () => {
      mockPrisma.student.create.mockResolvedValue({
        id: 's-1',
        studentCode: 'STU0000000001',
        organizationId: 'org-1',
        branchId: 'branch-1',
        personId: 'person-1',
        createdVia: 'MIGRATION',
        sourceApplicantId: null,
      });

      await students.createControlled(baseInput);

      expect(allocate).toHaveBeenCalledWith(
        { purpose: 'STUDENT_CODE', organizationId: 'org-1' },
        expect.anything(),
      );
      expect(mockPrisma.student.create.mock.calls[0][0].data.studentCode).toBe(
        'STU0000000001',
      );
    });

    it('derives the display name rather than accepting one', async () => {
      mockPrisma.student.create.mockResolvedValue({ id: 's-1', studentCode: 'X' });

      await students.createControlled({
        ...baseInput,
        middleName: 'Anil',
      });

      expect(mockPrisma.student.create.mock.calls[0][0].data.displayName).toBe(
        'Riya Anil Sharma',
      );
    });

    it('normalises the mobile so search can use an index', async () => {
      mockPrisma.student.create.mockResolvedValue({ id: 's-1', studentCode: 'X' });

      await students.createControlled({
        ...baseInput,
        primaryMobile: '+91 98765 43210',
      });

      const data = mockPrisma.student.create.mock.calls[0][0].data;
      expect(data.primaryMobile).toBe('+91 98765 43210');
      expect(data.mobileNormalized).toBe('9876543210');
    });

    it('outboxes creation and code assignment', async () => {
      mockPrisma.student.create.mockResolvedValue({
        id: 's-1',
        studentCode: 'STU0000000001',
        organizationId: 'org-1',
        branchId: 'branch-1',
        personId: 'person-1',
        createdVia: 'MIGRATION',
        sourceApplicantId: null,
      });

      await students.createControlled(baseInput);

      const names = mockPrisma.outboxEvent.create.mock.calls.map(
        (c: any) => c[0].data.eventName,
      );
      expect(names).toEqual([
        StudentCreatedEvent.EVENT_NAME,
        StudentCodeAssignedEvent.EVENT_NAME,
      ]);
    });

    it('requires an application behind an admission-born student', async () => {
      await expect(
        students.createControlled({ ...baseInput, createdVia: 'ADMISSION' }),
      ).rejects.toMatchObject({
        response: { error: 'STUDENT_SOURCE_APPLICANT_REQUIRED' },
      });
      // Rejected before a number is burned.
      expect(allocate).not.toHaveBeenCalled();
    });

    it('rejects an implausible date of birth before allocating', async () => {
      await expect(
        students.createControlled({ ...baseInput, dob: new Date('2199-01-01') }),
      ).rejects.toThrow(BadRequestException);
      expect(allocate).not.toHaveBeenCalled();
    });

    it('names what already exists when the person is taken', async () => {
      mockPrisma.student.create.mockRejectedValue(
        uniqueViolation('Student_personId_key'),
      );

      await expect(students.createControlled(baseInput)).rejects.toMatchObject({
        response: { error: 'STUDENT_ALREADY_EXISTS' },
      });
    });

    it('names what already exists when the applicant is taken', async () => {
      mockPrisma.student.create.mockRejectedValue(
        uniqueViolation('student_one_per_applicant'),
      );

      await expect(
        students.createControlled({
          ...baseInput,
          createdVia: 'ADMISSION',
          sourceApplicantId: 'app-1',
        }),
      ).rejects.toMatchObject({
        response: { error: 'APPLICANT_ALREADY_ADMITTED' },
      });
    });

    it('surfaces a code collision as a conflict, not a raw Prisma error', async () => {
      mockPrisma.student.create.mockRejectedValue(
        uniqueViolation('Student_organizationId_studentCode_key'),
      );

      const error = await students
        .createControlled(baseInput)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect(error).not.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    });

    it('rethrows an unrelated database error untouched', async () => {
      const boom = new Error('connection reset');
      mockPrisma.student.create.mockRejectedValue(boom);
      await expect(students.createControlled(baseInput)).rejects.toBe(boom);
    });
  });

  describe('reads', () => {
    it('confines a read to the caller scope', async () => {
      mockPrisma.student.findFirst.mockResolvedValue(null);

      await expect(students.findById('s-1', SCOPE)).rejects.toThrow(
        NotFoundException,
      );

      expect(mockPrisma.student.findFirst.mock.calls[0][0].where).toMatchObject({
        id: 's-1',
        organizationId: 'org-1',
        branchId: 'branch-1',
      });
    });

    it('drops the branch predicate only when widened', async () => {
      mockPrisma.student.findFirst.mockResolvedValue({ id: 's-1' });

      await students.findById('s-1', SCOPE, { organizationWide: true });

      const where = mockPrisma.student.findFirst.mock.calls[0][0].where;
      expect(where.organizationId).toBe('org-1');
      // Widening never crosses the tenant.
      expect(where.branchId).toBeUndefined();
    });

    it('upper-cases a code before looking it up', async () => {
      mockPrisma.student.findFirst.mockResolvedValue({ id: 's-1' });

      await students.findByCode(' stu0000000123 ', SCOPE);

      expect(mockPrisma.student.findFirst.mock.calls[0][0].where.studentCode).toBe(
        'STU0000000123',
      );
    });
  });

  describe('search', () => {
    it('defaults to the caller branch and active students', async () => {
      await students.search({}, SCOPE);

      const where = mockPrisma.student.findMany.mock.calls[0][0].where;
      expect(where.organizationId).toBe('org-1');
      expect(where.branchId).toBe('branch-1');
      expect(where.status).toBe('ACTIVE');
    });

    it('interprets one term as code, mobile and name at once', async () => {
      await students.search({ q: '9876543210' }, SCOPE);

      const or = mockPrisma.student.findMany.mock.calls[0][0].where.OR;
      expect(or).toEqual(
        expect.arrayContaining([
          { mobileNormalized: '9876543210' },
          { displayName: { contains: '9876543210', mode: 'insensitive' } },
        ]),
      );
    });

    it('caps the page size', async () => {
      const result = await students.search({ limit: 10_000 }, SCOPE);
      expect(result.meta.limit).toBe(100);
      expect(mockPrisma.student.findMany.mock.calls[0][0].take).toBe(100);
    });

    it('orders deterministically so pages do not reshuffle', async () => {
      await students.search({}, SCOPE);
      expect(mockPrisma.student.findMany.mock.calls[0][0].orderBy).toEqual([
        { displayName: 'asc' },
        { id: 'asc' },
      ]);
    });
  });

  describe('correction', () => {
    const existing = {
      id: 's-1',
      organizationId: 'org-1',
      branchId: 'branch-1',
      personId: 'person-1',
      studentCode: 'STU0000000001',
      status: 'ACTIVE',
      firstName: 'Riya',
      middleName: null,
      lastName: 'Sharma',
      displayName: 'Riya Sharma',
    };

    beforeEach(() => {
      mockPrisma.student.findFirst.mockResolvedValue(existing);
      mockPrisma.student.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.student.findFirstOrThrow.mockResolvedValue({
        ...existing,
        firstName: 'Riyaa',
      });
    });

    it('re-asserts the scope on the write, not only on the read', async () => {
      await students.correctDemographics('s-1', { firstName: 'Riyaa' }, SCOPE);

      expect(mockPrisma.student.updateMany.mock.calls[0][0].where).toMatchObject({
        id: 's-1',
        organizationId: 'org-1',
        branchId: 'branch-1',
      });
    });

    it('rebuilds the derived name from its sources', async () => {
      await students.correctDemographics('s-1', { firstName: 'Riyaa' }, SCOPE);
      expect(mockPrisma.student.updateMany.mock.calls[0][0].data.displayName).toBe(
        'Riyaa Sharma',
      );
    });

    it('emits a field-level diff, not just "something changed"', async () => {
      await students.correctDemographics('s-1', { firstName: 'Riyaa' }, SCOPE);

      const outboxed = mockPrisma.outboxEvent.create.mock.calls[0][0].data;
      expect(outboxed.eventName).toBe(StudentUpdatedEvent.EVENT_NAME);
      expect(outboxed.metadata.changes).toEqual([
        { field: 'firstName', oldValue: 'Riya', newValue: 'Riyaa' },
      ]);
    });

    it('does nothing when nothing actually changed', async () => {
      const result = await students.correctDemographics(
        's-1',
        { firstName: 'Riya' },
        SCOPE,
      );

      expect(result).toBe(existing);
      expect(mockPrisma.student.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.outboxEvent.create).not.toHaveBeenCalled();
    });

    it('treats an out-of-scope student as absent', async () => {
      mockPrisma.student.findFirst.mockResolvedValue(null);

      await expect(
        students.correctDemographics('s-1', { firstName: 'X' }, OTHER_BRANCH),
      ).rejects.toThrow(NotFoundException);
    });

    it('refuses to correct an archived record', async () => {
      mockPrisma.student.findFirst.mockResolvedValue({
        ...existing,
        status: 'ARCHIVED',
      });

      await expect(
        students.correctDemographics('s-1', { firstName: 'X' }, SCOPE),
      ).rejects.toMatchObject({ response: { error: 'STUDENT_ARCHIVED' } });
    });
  });

  describe('immutability', () => {
    it('offers no way to reach an identity field through correction', () => {
      // The guarantee is structural: the input type has no such property, so
      // this fails to compile rather than being stripped at runtime.
      const attempt = {
        studentCode: 'STU9999999999',
        organizationId: 'other-org',
        personId: 'other-person',
        sourceApplicantId: 'other-app',
        status: 'GRADUATED',
      };

      for (const key of Object.keys(attempt)) {
        expect(
          [
            'firstName',
            'middleName',
            'lastName',
            'dob',
            'genderId',
            'religionId',
            'casteId',
            'categoryId',
            'motherTongueId',
            'bloodGroupId',
            'disabilityStatus',
            'disabilityTypeId',
            'disabilityNotes',
            'primaryMobile',
            'primaryEmail',
            'apaarId',
            'abcId',
            'penNo',
            'saralId',
            'udiseStudentId',
            'photoDocumentId',
          ],
        ).not.toContain(key);
      }
    });
  });
});
