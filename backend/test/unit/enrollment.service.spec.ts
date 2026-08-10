import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  EnrollmentStatus as S,
  EnrollmentOriginType,
  Prisma,
} from '@/generated/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { RowLockService } from '@/infrastructure/database/row-lock.service';
import { OutboxPublisher } from '@/infrastructure/outbox/outbox.publisher';
import { AuthorizationService } from '@/modules/authorization/authorization.service';
import { EnrollmentService } from '@/modules/enrollment/enrollment.service';
import {
  EnrollmentConfigProvider,
  RollNumberPolicy,
} from '@/modules/enrollment/enrollment-config.provider';
import {
  isLegalTransition,
  isOpen,
  nextStatuses,
  statusesWithNoExit,
  TERMINAL_STATUSES,
} from '@/modules/enrollment/enrollment.transitions';
import { ResourceScope } from '@/common/scope/resource-scope';

const SCOPE: ResourceScope = {
  organizationId: 'org-1',
  branchId: 'branch-1',
  academicYearId: 'year-1',
};

const OTHER_BRANCH: ResourceScope = { ...SCOPE, branchId: 'branch-2' };
const ACTOR = { userId: 'user-1', role: 'BRANCH_ADMIN' };

const PLACEMENT = {
  organizationId: 'org-1',
  branchId: 'branch-1',
  academicYearId: 'year-1',
  admissionId: 'adm-1',
  studentId: 'stu-1',
  programId: 'prog-1',
  academicUnitId: 'unit-1',
};

describe('Enrollment', () => {
  let enrollments: EnrollmentService;
  let config: EnrollmentConfigProvider;

  const rawQuery = jest.fn() as jest.Mock & {
    enrollment: Record<string, unknown>[];
    year: Record<string, unknown>[];
  };
  rawQuery.enrollment = [];
  rawQuery.year = [{ id: 'year-1', isLocked: false, isDeleted: false }];

  const hasPermission = jest.fn().mockResolvedValue(true);

  const mockPrisma: any = {
    enrollment: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    workflowHistory: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    outboxEvent: { create: jest.fn().mockResolvedValue({ id: 'ob-1' }) },
    $transaction: jest.fn((cb: any) => cb(mockPrisma)),
    $queryRawUnsafe: rawQuery,
  };

  /** Put a placement under the lock in a given state. */
  const inState = (status: S, extra: Record<string, unknown> = {}) => {
    rawQuery.enrollment = [
      {
        id: 'enr-1',
        ...PLACEMENT,
        rollNumber: null,
        enrollmentKind: 'PRIMARY',
        enrollmentStatus: status,
        originType: 'ADMISSION',
        supersededById: null,
        applicantId: null,
        resultOutcome: null,
        version: 1,
        deletedAt: null,
        ...extra,
      },
    ];
  };

  const lockYear = (isLocked: boolean) => {
    rawQuery.year = [{ id: 'year-1', isLocked, isDeleted: false }];
  };

  beforeEach(async () => {
    rawQuery.mockImplementation((sql: string) => {
      if (!String(sql).includes('FOR ')) return Promise.resolve([]);
      return Promise.resolve(
        String(sql).includes('"AcademicYear"') ? rawQuery.year : rawQuery.enrollment,
      );
    });

    mockPrisma.enrollment.create.mockImplementation((args: any) =>
      Promise.resolve({ id: 'enr-new', version: 1, ...args.data }),
    );
    mockPrisma.enrollment.update.mockImplementation((args: any) =>
      Promise.resolve({
        id: args.where.id,
        ...PLACEMENT,
        version: 2,
        ...args.data,
      }),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnrollmentService,
        EnrollmentConfigProvider,
        // Real, because they are thin and the wiring is what is under test.
        RowLockService,
        OutboxPublisher,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuthorizationService, useValue: { hasPermission } },
      ],
    }).compile();

    enrollments = module.get(EnrollmentService);
    config = module.get(EnrollmentConfigProvider);
  });

  afterEach(() => {
    jest.clearAllMocks();
    rawQuery.enrollment = [];
    rawQuery.year = [{ id: 'year-1', isLocked: false, isDeleted: false }];
    hasPermission.mockResolvedValue(true);
  });

  const errorCode = (e: unknown) =>
    (e as { response?: { error?: string } })?.response?.error;

  // ---------------------------------------------------------------------------

  describe('the status table', () => {
    /**
     * Catches the failure mode where somebody adds a status and forgets its
     * edges: the new state becomes unreachable and inescapable, and nothing
     * says so.
     */
    it('accounts for every status in the enum', () => {
      const reachable = new Set(
        Object.values(S).flatMap((from) => nextStatuses(from)),
      );

      for (const status of Object.values(S)) {
        const accounted =
          status === S.PENDING ||
          reachable.has(status) ||
          nextStatuses(status).length > 0;
        expect({ status, accounted }).toEqual({ status, accounted: true });
      }
    });

    it('leaves exactly the historical statuses with no way out', () => {
      expect(statusesWithNoExit().sort()).toEqual([...TERMINAL_STATUSES].sort());
    });

    it('never reopens a closed placement', () => {
      // A mistake is put right by a new row, so both versions stay visible.
      // An edge back to ACTIVE would let history be rewritten in place.
      for (const status of TERMINAL_STATUSES) {
        expect(isLegalTransition(status, S.ACTIVE)).toBe(false);
        expect(isOpen(status)).toBe(false);
      }
    });

    it('has no SUSPENDED status', () => {
      // Suspension is a property of the human: a suspended student still holds
      // their seat in 9-A. Duplicating it here would leave two aggregates
      // disagreeing about one fact.
      expect(Object.values(S)).not.toContain('SUSPENDED');
    });

    it('never lists a status as its own successor', () => {
      for (const status of Object.values(S)) {
        expect(nextStatuses(status)).not.toContain(status);
      }
    });

    it('lets a break resume', () => {
      expect(isLegalTransition(S.ON_BREAK, S.ACTIVE)).toBe(true);
      expect(isOpen(S.ON_BREAK)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------

  describe('createInitialEnrollment', () => {
    it('writes the placement and outboxes one creation event', async () => {
      await enrollments.createInitialEnrollment({ ...PLACEMENT });

      const data = mockPrisma.enrollment.create.mock.calls[0][0].data;
      expect(data).toMatchObject({
        ...PLACEMENT,
        enrollmentKind: 'PRIMARY',
        enrollmentStatus: 'ACTIVE',
        originType: 'ADMISSION',
        isRepeat: false,
      });

      expect(mockPrisma.outboxEvent.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.outboxEvent.create.mock.calls[0][0].data.eventName).toBe(
        'enrollment.created',
      );
    });

    /**
     * Phase 5 composes Student, Admission and Enrollment in one transaction.
     * A method that quietly ignored the passed client and used the global one
     * is the single most common way an "atomic" operation turns out not to be.
     */
    it('uses the caller transaction and opens none of its own', async () => {
      const tx: any = {
        enrollment: { create: jest.fn().mockResolvedValue({ id: 'enr-tx', ...PLACEMENT }) },
        outboxEvent: { create: jest.fn().mockResolvedValue({}) },
        $queryRawUnsafe: rawQuery,
      };

      await enrollments.createInitialEnrollment({ ...PLACEMENT }, tx);

      expect(tx.enrollment.create).toHaveBeenCalledTimes(1);
      expect(tx.outboxEvent.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockPrisma.enrollment.create).not.toHaveBeenCalled();
    });

    it('refuses to write into a locked year', async () => {
      lockYear(true);

      await expect(
        enrollments.createInitialEnrollment({ ...PLACEMENT }),
      ).rejects.toMatchObject({ response: { error: 'ACADEMIC_YEAR_LOCKED' } });

      expect(mockPrisma.enrollment.create).not.toHaveBeenCalled();
    });

    it('refuses an origin that must replace something', async () => {
      for (const originType of [
        EnrollmentOriginType.CORRECTION,
        EnrollmentOriginType.TRANSFER,
      ]) {
        await expect(
          enrollments.createInitialEnrollment({ ...PLACEMENT, originType }),
        ).rejects.toMatchObject({
          response: { error: 'ORIGIN_REQUIRES_SUPERSEDE' },
        });
      }
    });

    it('accepts the importer origins', async () => {
      for (const originType of [
        EnrollmentOriginType.MIGRATION,
        EnrollmentOriginType.READMISSION,
        EnrollmentOriginType.PROMOTION,
        EnrollmentOriginType.REPEAT,
      ]) {
        await expect(
          enrollments.createInitialEnrollment({ ...PLACEMENT, originType }),
        ).resolves.toBeDefined();
      }
    });

    it('never reads a request context for scope', async () => {
      // Every scope value comes from the input, which the orchestrator took
      // from the Admission's lineage. There is no path by which a caller's own
      // branch could be stamped onto another branch's placement.
      await enrollments.createInitialEnrollment({
        ...PLACEMENT,
        organizationId: 'org-9',
        branchId: 'branch-9',
      });

      const data = mockPrisma.enrollment.create.mock.calls[0][0].data;
      expect(data.organizationId).toBe('org-9');
      expect(data.branchId).toBe('branch-9');
    });

    it('stores no demographic field', async () => {
      await enrollments.createInitialEnrollment({ ...PLACEMENT });

      const written = Object.keys(mockPrisma.enrollment.create.mock.calls[0][0].data);
      for (const forbidden of [
        'firstName',
        'lastName',
        'dob',
        'gender',
        'genderId',
        'mobile',
        'email',
        'aadhaarNo',
        'address',
        'studentCode',
        'admissionNo',
      ]) {
        expect(written).not.toContain(forbidden);
      }
    });
  });

  // ---------------------------------------------------------------------------

  describe('supersede', () => {
    it('locks the old row before creating the replacement', async () => {
      inState(S.ACTIVE);

      await enrollments.correctPlacement(
        'enr-1',
        { academicUnitId: 'unit-2', reason: 'wrong class at admission' },
        SCOPE,
        ACTOR,
      );

      // Creating the replacement first and then discovering the original was
      // already superseded leaves an orphan that satisfies every constraint
      // and means nothing.
      const lockOrder = rawQuery.mock.invocationCallOrder[0];
      const createOrder = mockPrisma.enrollment.create.mock.invocationCallOrder[0];
      expect(lockOrder).toBeLessThan(createOrder);
    });

    it('links both directions and closes the original', async () => {
      inState(S.ACTIVE);

      await enrollments.correctPlacement(
        'enr-1',
        { academicUnitId: 'unit-2', reason: 'wrong class at admission' },
        SCOPE,
        ACTOR,
      );

      const created = mockPrisma.enrollment.create.mock.calls[0][0].data;
      expect(created).toMatchObject({
        previousEnrollmentId: 'enr-1',
        originType: 'CORRECTION',
        enrollmentStatus: 'ACTIVE',
        changeReason: 'wrong class at admission',
      });

      const closed = mockPrisma.enrollment.update.mock.calls[0][0];
      expect(closed.where).toEqual({ id: 'enr-1' });
      expect(closed.data).toMatchObject({
        enrollmentStatus: 'SUPERSEDED',
        changeReason: 'wrong class at admission',
      });

      // The id is generated before either write, because the old row has to be
      // closed first — the live-placement index counts it otherwise — and
      // closing it requires naming its successor.
      expect(closed.data.supersededById).toBe(created.id);
      expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('copies scope, admission and student from the row it replaces', async () => {
      inState(S.ACTIVE);

      await enrollments.correctPlacement(
        'enr-1',
        { academicUnitId: 'unit-2', reason: 'wrong class' },
        // A caller whose context says another branch cannot move the placement
        // there: the replacement inherits the original's lineage.
        SCOPE,
        ACTOR,
      );

      expect(mockPrisma.enrollment.create.mock.calls[0][0].data).toMatchObject({
        organizationId: 'org-1',
        branchId: 'branch-1',
        academicYearId: 'year-1',
        admissionId: 'adm-1',
        studentId: 'stu-1',
      });
    });

    it('carries over what the caller did not name', async () => {
      inState(S.ACTIVE, { rollNumber: '9', programId: 'prog-1' });

      await enrollments.correctPlacement(
        'enr-1',
        { academicUnitId: 'unit-2', reason: 'section correction' },
        SCOPE,
        ACTOR,
      );

      // A section change must not silently move the programme too.
      const created = mockPrisma.enrollment.create.mock.calls[0][0].data;
      expect(created.programId).toBe('prog-1');
      expect(created.rollNumber).toBe('9');
    });

    it('marks a transfer by its origin, not by a different closing status', async () => {
      inState(S.ACTIVE);

      await enrollments.transferPlacement(
        'enr-1',
        { academicUnitId: 'unit-2', reason: 'section change' },
        SCOPE,
        ACTOR,
      );

      // A same-branch move closes the old row exactly as a correction does.
      // `TRANSFERRED` belongs to the branch transfer, whose replacement sits
      // under a different admission — and it is not excluded from the
      // one-live-placement index, so using it here would make the replacement
      // unwritable. What tells a mistake from a real move is `originType`.
      expect(mockPrisma.enrollment.update.mock.calls[0][0].data.enrollmentStatus).toBe(
        'SUPERSEDED',
      );
      expect(mockPrisma.enrollment.create.mock.calls[0][0].data.originType).toBe(
        'TRANSFER',
      );
    });

    it('writes one history row per side and two events', async () => {
      inState(S.ACTIVE);

      await enrollments.correctPlacement(
        'enr-1',
        { academicUnitId: 'unit-2', reason: 'wrong class' },
        SCOPE,
        ACTOR,
      );

      expect(mockPrisma.workflowHistory.create).toHaveBeenCalledTimes(2);
      const replacementId = mockPrisma.enrollment.create.mock.calls[0][0].data.id;
      expect(
        mockPrisma.workflowHistory.create.mock.calls.map(
          (c: any) => c[0].data.entityId,
        ),
      ).toEqual(['enr-1', replacementId]);

      const events = mockPrisma.outboxEvent.create.mock.calls.map(
        (c: any) => c[0].data.eventName,
      );
      // Attendance and marks hold rows against the old id, so a create event
      // alone would not tell them their own reference has been retired.
      expect(events).toEqual(['enrollment.created', 'enrollment.superseded']);
    });

    it.each(['', '   ', '\t\n', undefined])(
      'refuses %p as a reason',
      async (reason) => {
        inState(S.ACTIVE);

        await expect(
          enrollments.correctPlacement(
            'enr-1',
            { academicUnitId: 'unit-2', reason: reason as string },
            SCOPE,
            ACTOR,
          ),
        ).rejects.toMatchObject({ response: { error: 'CHANGE_REASON_REQUIRED' } });

        expect(mockPrisma.enrollment.create).not.toHaveBeenCalled();
      },
    );

    it('trims the reason it stores', async () => {
      inState(S.ACTIVE);

      await enrollments.correctPlacement(
        'enr-1',
        { academicUnitId: 'unit-2', reason: '   wrong class   ' },
        SCOPE,
        ACTOR,
      );

      expect(mockPrisma.enrollment.create.mock.calls[0][0].data.changeReason).toBe(
        'wrong class',
      );
    });

    it.each(TERMINAL_STATUSES)('refuses to replace a %s placement', async (status) => {
      inState(status);

      await expect(
        enrollments.correctPlacement(
          'enr-1',
          { academicUnitId: 'unit-2', reason: 'too late' },
          SCOPE,
          ACTOR,
        ),
      ).rejects.toMatchObject({ response: { error: 'ENROLLMENT_CLOSED' } });

      expect(mockPrisma.enrollment.create).not.toHaveBeenCalled();
      expect(mockPrisma.enrollment.update).not.toHaveBeenCalled();
    });

    it('refuses a correction that changes nothing', async () => {
      inState(S.ACTIVE);

      await expect(
        enrollments.correctPlacement(
          'enr-1',
          { programId: 'prog-1', academicUnitId: 'unit-1', reason: 'no change' },
          SCOPE,
          ACTOR,
        ),
      ).rejects.toMatchObject({ response: { error: 'PLACEMENT_UNCHANGED' } });
    });

    it('refuses to write into a locked year', async () => {
      inState(S.ACTIVE);
      lockYear(true);

      await expect(
        enrollments.correctPlacement(
          'enr-1',
          { academicUnitId: 'unit-2', reason: 'wrong class' },
          SCOPE,
          ACTOR,
        ),
      ).rejects.toMatchObject({ response: { error: 'ACADEMIC_YEAR_LOCKED' } });
    });

    it('holds the year still with a shared lock, not an exclusive one', async () => {
      inState(S.ACTIVE);

      await enrollments.correctPlacement(
        'enr-1',
        { academicUnitId: 'unit-2', reason: 'wrong class' },
        SCOPE,
        ACTOR,
      );

      const yearLock = rawQuery.mock.calls.find((c) =>
        String(c[0]).includes('"AcademicYear"'),
      );
      // FOR SHARE blocks the UPDATE that sets isLocked while letting sibling
      // enrolments in the same year proceed. FOR UPDATE would serialise every
      // placement write in the year behind one row.
      expect(String(yearLock![0])).toContain('FOR SHARE');
      expect(String(yearLock![0])).not.toContain('FOR UPDATE');
    });

    it('refuses a stale version', async () => {
      inState(S.ACTIVE, { version: 4 });

      await expect(
        enrollments.correctPlacement(
          'enr-1',
          { academicUnitId: 'unit-2', reason: 'wrong class', expectedVersion: 3 },
          SCOPE,
          ACTOR,
        ),
      ).rejects.toMatchObject({
        response: { error: 'STALE_ENROLLMENT_VERSION', currentVersion: 4 },
      });
    });

    it('accepts a matching version and bumps it', async () => {
      inState(S.ACTIVE, { version: 4 });

      await enrollments.correctPlacement(
        'enr-1',
        { academicUnitId: 'unit-2', reason: 'wrong class', expectedVersion: 4 },
        SCOPE,
        ACTOR,
      );

      expect(mockPrisma.enrollment.update.mock.calls[0][0].data.version).toEqual({
        increment: 1,
      });
    });
  });

  // ---------------------------------------------------------------------------

  describe('cancel', () => {
    it('records a date and a reason and keeps the row', async () => {
      inState(S.ACTIVE);

      await enrollments.cancelEnrollment(
        'enr-1',
        { reason: 'duplicate placement created in error' },
        SCOPE,
        ACTOR,
      );

      const data = mockPrisma.enrollment.update.mock.calls[0][0].data;
      expect(data.enrollmentStatus).toBe('CANCELLED');
      expect(data.exitDate).toBeInstanceOf(Date);
      expect(data.exitReason).toBe('CANCELLED_BEFORE_JOINING');
      expect(data.changeReason).toBe('duplicate placement created in error');
    });

    it('emits a status change, not a creation', async () => {
      inState(S.ACTIVE);

      await enrollments.cancelEnrollment('enr-1', { reason: 'void' }, SCOPE, ACTOR);

      expect(mockPrisma.enrollment.create).not.toHaveBeenCalled();
      expect(mockPrisma.outboxEvent.create.mock.calls[0][0].data.eventName).toBe(
        'enrollment.status_changed',
      );
    });

    it('refuses once a result has been recorded', async () => {
      inState(S.ACTIVE, { resultOutcome: 'PASS' });

      // Marks pointing at a placement that officially never happened is worse
      // than a wrong placement.
      await expect(
        enrollments.cancelEnrollment('enr-1', { reason: 'void' }, SCOPE, ACTOR),
      ).rejects.toMatchObject({ response: { error: 'ENROLLMENT_HAS_RESULT' } });
    });

    it.each(TERMINAL_STATUSES)('refuses to cancel a %s placement', async (status) => {
      inState(status);

      await expect(
        enrollments.cancelEnrollment('enr-1', { reason: 'void' }, SCOPE, ACTOR),
      ).rejects.toMatchObject({ response: { error: 'ENROLLMENT_CLOSED' } });
    });

    it('requires a reason', async () => {
      inState(S.ACTIVE);

      await expect(
        enrollments.cancelEnrollment('enr-1', { reason: '  ' }, SCOPE, ACTOR),
      ).rejects.toMatchObject({ response: { error: 'CHANGE_REASON_REQUIRED' } });
    });

    it('refuses inside a locked year', async () => {
      inState(S.ACTIVE);
      lockYear(true);

      await expect(
        enrollments.cancelEnrollment('enr-1', { reason: 'void' }, SCOPE, ACTOR),
      ).rejects.toMatchObject({ response: { error: 'ACADEMIC_YEAR_LOCKED' } });
    });
  });

  // ---------------------------------------------------------------------------

  describe('roll number', () => {
    it('changes only the position, never the placement', async () => {
      inState(S.ACTIVE, { rollNumber: '4' });

      await enrollments.assignRollNumber(
        'enr-1',
        { rollNumber: '17' },
        SCOPE,
        ACTOR,
      );

      const data = mockPrisma.enrollment.update.mock.calls[0][0].data;
      expect(data.rollNumber).toBe('17');
      expect(Object.keys(data).sort()).toEqual(
        ['rollNumber', 'updatedBy', 'version'].sort(),
      );
      // The student is in the same class before and after, so nothing is
      // superseded.
      expect(mockPrisma.enrollment.create).not.toHaveBeenCalled();
    });

    it('clears the position when told to', async () => {
      inState(S.ACTIVE, { rollNumber: '4' });

      await enrollments.assignRollNumber('enr-1', { rollNumber: null }, SCOPE, ACTOR);

      expect(mockPrisma.enrollment.update.mock.calls[0][0].data.rollNumber).toBeNull();
    });

    it('refuses a blank position', async () => {
      inState(S.ACTIVE);

      await expect(
        enrollments.assignRollNumber('enr-1', { rollNumber: '   ' }, SCOPE, ACTOR),
      ).rejects.toMatchObject({ response: { error: 'ROLL_NUMBER_INVALID' } });
    });

    it('refuses once the class list is locked', async () => {
      inState(S.ACTIVE);
      lockYear(true);

      // Today the class list locks with its academic year. That is coarser than
      // the eventual per-unit rule and never weaker, so nothing that should be
      // refused gets through.
      await expect(
        enrollments.assignRollNumber('enr-1', { rollNumber: '17' }, SCOPE, ACTOR),
      ).rejects.toMatchObject({ response: { error: 'CLASS_LIST_LOCKED' } });
    });

    it('asks the policy provider, not the year directly', async () => {
      inState(S.ACTIVE);
      const spy = jest
        .spyOn(config, 'classListLocked')
        .mockReturnValue(true);

      await expect(
        enrollments.assignRollNumber('enr-1', { rollNumber: '17' }, SCOPE, ACTOR),
      ).rejects.toMatchObject({ response: { error: 'CLASS_LIST_LOCKED' } });

      expect(spy).toHaveBeenCalledWith(
        { organizationId: 'org-1', branchId: 'branch-1' },
        false,
        'unit-1',
      );
    });

    it('emits its own event', async () => {
      inState(S.ACTIVE, { rollNumber: '4' });

      await enrollments.assignRollNumber('enr-1', { rollNumber: '17' }, SCOPE, ACTOR);

      const event = mockPrisma.outboxEvent.create.mock.calls[0][0].data;
      expect(event.eventName).toBe('enrollment.roll_number_changed');
      expect(event.payload).toMatchObject({ from: '4', to: '17' });
    });

    it.each(TERMINAL_STATUSES)(
      'leaves a %s placement with the number it had',
      async (status) => {
        inState(status, { rollNumber: '4' });

        await expect(
          enrollments.assignRollNumber('enr-1', { rollNumber: '17' }, SCOPE, ACTOR),
        ).rejects.toMatchObject({ response: { error: 'ENROLLMENT_CLOSED' } });
      },
    );

    it('defaults to manual assignment', () => {
      // A number the system chose is a number nobody can explain to the parent
      // who asks why their child is Roll 34.
      expect(config.rollNumberPolicy({ organizationId: 'org-1' })).toBe(
        RollNumberPolicy.MANUAL,
      );
    });
  });

  // ---------------------------------------------------------------------------

  describe('scope and permissions', () => {
    it('locks within the caller scope', async () => {
      inState(S.ACTIVE);

      await enrollments.correctPlacement(
        'enr-1',
        { academicUnitId: 'unit-2', reason: 'wrong class' },
        SCOPE,
        ACTOR,
      );

      const lock = rawQuery.mock.calls.find((c) =>
        String(c[0]).includes('"Enrollment"'),
      );
      expect(String(lock![0])).toContain('"organizationId"');
      expect(String(lock![0])).toContain('"branchId"');
      expect(String(lock![0])).toContain('FOR UPDATE');
    });

    it('treats an out-of-scope placement as absent', async () => {
      rawQuery.enrollment = [];

      await expect(
        enrollments.correctPlacement(
          'enr-1',
          { academicUnitId: 'unit-2', reason: 'wrong class' },
          OTHER_BRANCH,
          ACTOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('treats a soft-deleted placement as absent', async () => {
      inState(S.ACTIVE, { deletedAt: new Date() });

      await expect(
        enrollments.correctPlacement(
          'enr-1',
          { academicUnitId: 'unit-2', reason: 'wrong class' },
          SCOPE,
          ACTOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('checks the permission each operation declares', async () => {
      inState(S.ACTIVE);
      await enrollments.correctPlacement(
        'enr-1',
        { academicUnitId: 'unit-2', reason: 'wrong class' },
        SCOPE,
        ACTOR,
      );
      expect(hasPermission).toHaveBeenCalledWith(
        'user-1',
        'BRANCH_ADMIN',
        'enrollment.correct',
      );

      jest.clearAllMocks();
      hasPermission.mockResolvedValue(true);
      inState(S.ACTIVE);
      await enrollments.cancelEnrollment('enr-1', { reason: 'void' }, SCOPE, ACTOR);
      expect(hasPermission).toHaveBeenCalledWith(
        'user-1',
        'BRANCH_ADMIN',
        'enrollment.cancel',
      );

      jest.clearAllMocks();
      hasPermission.mockResolvedValue(true);
      inState(S.ACTIVE);
      await enrollments.assignRollNumber('enr-1', { rollNumber: '3' }, SCOPE, ACTOR);
      expect(hasPermission).toHaveBeenCalledWith(
        'user-1',
        'BRANCH_ADMIN',
        'enrollment.rollnumber.manage',
      );
    });

    it('refuses an actor without the permission', async () => {
      inState(S.ACTIVE);
      hasPermission.mockResolvedValue(false);

      await expect(
        enrollments.correctPlacement(
          'enr-1',
          { academicUnitId: 'unit-2', reason: 'wrong class' },
          SCOPE,
          ACTOR,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.enrollment.create).not.toHaveBeenCalled();
    });

    it('refuses an anonymous caller', async () => {
      inState(S.ACTIVE);

      await expect(
        enrollments.correctPlacement(
          'enr-1',
          { academicUnitId: 'unit-2', reason: 'wrong class' },
          SCOPE,
          { userId: null, role: null },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lets a system caller act without a permission check', async () => {
      inState(S.ACTIVE);

      await enrollments.correctPlacement(
        'enr-1',
        { academicUnitId: 'unit-2', reason: 'migration fix-up' },
        SCOPE,
        { system: true },
      );

      expect(hasPermission).not.toHaveBeenCalled();
      expect(mockPrisma.workflowHistory.create.mock.calls[0][0].data.actionBy).toBe(
        'SYSTEM',
      );
    });
  });

  // ---------------------------------------------------------------------------

  describe('reads', () => {
    it('scopes a lookup by organization and branch', async () => {
      mockPrisma.enrollment.findFirst.mockResolvedValue({ id: 'enr-1' });

      await enrollments.findById('enr-1', SCOPE);

      expect(mockPrisma.enrollment.findFirst.mock.calls[0][0].where).toMatchObject({
        id: 'enr-1',
        organizationId: 'org-1',
        branchId: 'branch-1',
        deletedAt: null,
      });
    });

    it('answers 404 for a placement outside the scope', async () => {
      mockPrisma.enrollment.findFirst.mockResolvedValue(null);

      await expect(enrollments.findById('enr-1', OTHER_BRANCH)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('probes the current placement by student and year', async () => {
      mockPrisma.enrollment.findFirst.mockResolvedValue(null);

      await enrollments.findCurrent('stu-1', 'year-1', SCOPE);

      // The query the partial unique index guarantees returns at most one row,
      // and the reason Student carries no currentEnrollmentId.
      expect(mockPrisma.enrollment.findFirst.mock.calls[0][0].where).toMatchObject({
        studentId: 'stu-1',
        academicYearId: 'year-1',
        enrollmentKind: 'PRIMARY',
        deletedAt: null,
      });
    });

    it('reads a student history across branches within the organization', async () => {
      await enrollments.findByStudent('stu-1', SCOPE);

      // A branch filter here would silently truncate the record a transfer
      // certificate is written from.
      const where = mockPrisma.enrollment.findMany.mock.calls[0][0].where;
      expect(where.organizationId).toBe('org-1');
      expect(where.branchId).toBeUndefined();
    });

    it('caps the page size', async () => {
      await enrollments.search({ limit: 5000 }, SCOPE);

      expect(mockPrisma.enrollment.findMany.mock.calls[0][0].take).toBe(200);
    });

    it('never lets a filter widen the scope', async () => {
      await enrollments.search(
        { academicUnitId: 'unit-9', organizationId: 'org-9' } as never,
        SCOPE,
      );

      const where = mockPrisma.enrollment.findMany.mock.calls[0][0].where;
      expect(where.organizationId).toBe('org-1');
      expect(where.branchId).toBe('branch-1');
    });
  });

  describe('what the service refuses to expose', () => {
    it('has no generic update', () => {
      expect((enrollments as never as Record<string, unknown>).update).toBeUndefined();
      expect(
        (enrollments as never as Record<string, unknown>).updateEnrollment,
      ).toBeUndefined();
    });

    it('has no delete of any kind', () => {
      for (const name of ['delete', 'remove', 'deleteEnrollment', 'hardDelete']) {
        expect(
          (enrollments as never as Record<string, unknown>)[name],
        ).toBeUndefined();
      }
    });

    it('never writes resultOutcome', async () => {
      inState(S.ACTIVE);

      await enrollments.createInitialEnrollment({ ...PLACEMENT });
      await enrollments.correctPlacement(
        'enr-1',
        { academicUnitId: 'unit-2', reason: 'wrong class' },
        SCOPE,
        ACTOR,
      );
      await enrollments.cancelEnrollment('enr-1', { reason: 'void' }, SCOPE, ACTOR);

      // Enrollment owns the column; Examination owns the decision.
      const writes = [
        ...mockPrisma.enrollment.create.mock.calls,
        ...mockPrisma.enrollment.update.mock.calls,
      ];
      for (const call of writes) {
        expect(Object.keys(call[0].data)).not.toContain('resultOutcome');
      }
    });

    it.each([
      ['enrollment_one_primary_per_year', 'ENROLLMENT_EXISTS_FOR_YEAR'],
      ['enrollment_rollno_unique', 'ROLL_NUMBER_TAKEN'],
      ['supersededById', 'ENROLLMENT_ALREADY_SUPERSEDED'],
    ])('translates the %s violation into %s', async (target, expected) => {
      inState(S.ACTIVE);
      mockPrisma.enrollment.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('unique violation', {
          code: 'P2002',
          clientVersion: 'test',
          meta: { target },
        }),
      );

      const caught = await enrollments
        .correctPlacement(
          'enr-1',
          { academicUnitId: 'unit-2', reason: 'wrong class' },
          SCOPE,
          ACTOR,
        )
        .catch((e: unknown) => e);

      // The caller gets a rule they can act on. A raw P2002 quoting an index
      // name tells them nothing and leaks a schema detail the API never
      // promised.
      expect(errorCode(caught)).toBe(expected);
      expect(JSON.stringify((caught as { response?: unknown }).response)).not.toContain(
        'P2002',
      );
    });

    it('translates a composite-key violation into a named mismatch', async () => {
      inState(S.ACTIVE);
      mockPrisma.enrollment.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('fk violation', {
          code: 'P2003',
          clientVersion: 'test',
          meta: { field_name: 'Enrollment_academicUnitId_branchId_programId_fkey' },
        }),
      );

      const caught = await enrollments
        .correctPlacement(
          'enr-1',
          { academicUnitId: 'unit-2', reason: 'wrong class' },
          SCOPE,
          ACTOR,
        )
        .catch((e: unknown) => e);

      expect(errorCode(caught)).toBe('ACADEMIC_UNIT_MISMATCH');
    });
  });
});
