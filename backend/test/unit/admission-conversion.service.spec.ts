import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { RowLockService } from '@/infrastructure/database/row-lock.service';
import { PersonService } from '@/modules/identity/person/person.service';
import { StudentService } from '@/modules/identity/student/student.service';
import { EnrollmentService } from '@/modules/enrollment/enrollment.service';
import { AuthorizationService } from '@/modules/authorization/authorization.service';
import { AdmissionService } from '@/modules/admissions/admission/admission.service';
import { WorkflowService } from '@/modules/admissions/workflow/workflow.service';
import { AdmissionConversionService } from '@/modules/admissions/admission/admission-conversion.service';
import { GuardianshipService } from '@/modules/admissions/guardians/guardianship.service';
import { WorkflowAction } from '@/modules/admissions/workflow/workflow.transitions';
import { ResourceScope } from '@/common/scope/resource-scope';

const SCOPE: ResourceScope = {
  organizationId: 'org-1',
  branchId: 'branch-1',
  academicYearId: 'year-1',
};

const OTHER_BRANCH: ResourceScope = { ...SCOPE, branchId: 'branch-2' };
const ACTOR = { userId: 'user-1', role: 'BRANCH_ADMIN' };
const REQUEST = { academicUnitId: 'unit-1' };

const APPLICANT = {
  id: 'app-1',
  organizationId: 'org-1',
  branchId: 'branch-1',
  academicYearId: 'year-1',
  admissionStatus: 'SEAT_CONFIRMED',
  programId: 'prog-1',
  personId: 'person-1',
  firstName: 'Riya',
  middleName: null,
  lastName: 'Sharma',
  dob: new Date('2015-04-12'),
  genderId: 'gender-1',
  religionId: null,
  casteId: null,
  categoryId: null,
  motherTongueId: null,
  bloodGroupId: null,
  disabilityStatus: false,
  disabilityTypeId: null,
  primaryMobile: '9876543210',
  primaryEmail: null,
  apaarId: null,
  penNo: null,
  aadhaarNo: '234567890123',
  quotaId: 'quota-1',
  admissionSourceId: 'source-1',
};

const UNIT = {
  id: 'unit-1',
  branchId: 'branch-1',
  programId: 'prog-1',
  academicYearId: 'year-1',
  isActive: true,
};

describe('Admission conversion', () => {
  let conversion: AdmissionConversionService;

  const rawQuery = jest.fn() as jest.Mock & { locked: unknown[] };
  rawQuery.locked = [];

  const hasPermission = jest.fn().mockResolvedValue(true);
  const resolvePerson = jest.fn();
  const createStudent = jest.fn();
  const createAdmission = jest.fn();
  const createEnrollment = jest.fn();
  const transition = jest.fn();
  const syncFromApplicantMappings = jest.fn().mockResolvedValue(undefined);

  const mockPrisma: any = {
    applicant: { findFirst: jest.fn() },
    academicUnit: { findFirst: jest.fn() },
    academicYear: { findFirst: jest.fn() },
    numberSequenceConfig: { findMany: jest.fn() },
    student: { findFirst: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn((cb: any) => cb(mockPrisma)),
    $queryRawUnsafe: rawQuery,
  };

  const lockedAs = (
    admissionStatus: string,
    extra: Record<string, unknown> = {},
  ) => {
    rawQuery.locked = [
      {
        id: 'app-1',
        admissionStatus,
        deletedAt: null,
        personId: 'person-1',
        ...extra,
      },
    ];
  };

  beforeEach(async () => {
    rawQuery.mockImplementation((sql: string) =>
      Promise.resolve(
        String(sql).includes('FOR UPDATE') ? rawQuery.locked : [],
      ),
    );

    mockPrisma.applicant.findFirst.mockResolvedValue({ ...APPLICANT });
    mockPrisma.academicUnit.findFirst.mockResolvedValue({ ...UNIT });
    mockPrisma.academicYear.findFirst.mockResolvedValue({
      id: 'year-1',
      isLocked: false,
      branchId: 'branch-1',
    });
    mockPrisma.numberSequenceConfig.findMany.mockResolvedValue([
      { purpose: 'STUDENT_CODE' },
      { purpose: 'ADMISSION_NO' },
    ]);
    mockPrisma.student.findFirst.mockResolvedValue(null);

    resolvePerson.mockResolvedValue({
      personId: 'person-1',
      created: true,
      matchedByGovernmentId: true,
      warnings: [],
    });
    createStudent.mockResolvedValue({
      id: 'stu-1',
      studentCode: 'STU0000000123',
    });
    createAdmission.mockResolvedValue({ id: 'adm-1', admissionNo: 'AD-00001' });
    createEnrollment.mockResolvedValue({ id: 'enr-1' });
    transition.mockResolvedValue({ id: 'app-1', admissionStatus: 'ADMITTED' });
    lockedAs('SEAT_CONFIRMED');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdmissionConversionService,
        RowLockService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PersonService, useValue: { resolve: resolvePerson } },
        {
          provide: StudentService,
          useValue: { createControlled: createStudent },
        },
        {
          provide: AdmissionService,
          useValue: { createControlled: createAdmission },
        },
        {
          provide: EnrollmentService,
          useValue: { createInitialEnrollment: createEnrollment },
        },
        { provide: WorkflowService, useValue: { transition } },
        { provide: AuthorizationService, useValue: { hasPermission } },
        {
          provide: GuardianshipService,
          useValue: { syncFromApplicantMappings },
        },
      ],
    }).compile();

    conversion = module.get(AdmissionConversionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    hasPermission.mockResolvedValue(true);
  });

  const errorCode = (e: unknown) =>
    (e as { response?: { error?: string } })?.response?.error;

  // ---------------------------------------------------------------------------

  describe('the happy path', () => {
    it('returns the four identifiers the caller needs', async () => {
      await expect(
        conversion.admit('app-1', REQUEST, SCOPE, ACTOR),
      ).resolves.toEqual({
        studentId: 'stu-1',
        studentCode: 'STU0000000123',
        admissionId: 'adm-1',
        admissionNo: 'AD-00001',
        enrollmentId: 'enr-1',
        applicantId: 'app-1',
      });
    });

    it('composes the services in dependency order', async () => {
      await conversion.admit('app-1', REQUEST, SCOPE, ACTOR);

      const order = [
        createStudent.mock.invocationCallOrder[0],
        createAdmission.mock.invocationCallOrder[0],
        createEnrollment.mock.invocationCallOrder[0],
        transition.mock.invocationCallOrder[0],
      ];
      expect(order).toEqual([...order].sort((a, b) => a - b));
    });

    it('locks the applicant before it does anything else', async () => {
      await conversion.admit('app-1', REQUEST, SCOPE, ACTOR);

      const lock = rawQuery.mock.invocationCallOrder[0];
      expect(lock).toBeLessThan(createStudent.mock.invocationCallOrder[0]);

      const sql = String(rawQuery.mock.calls[0][0]);
      expect(sql).toContain('"Applicant"');
      expect(sql).toContain('FOR UPDATE');
      expect(sql).toContain('"organizationId"');
      expect(sql).toContain('"branchId"');
    });

    /** The property the whole phase exists for. */
    it('hands every service the same transaction client', async () => {
      await conversion.admit('app-1', REQUEST, SCOPE, ACTOR);

      const clients = [
        createStudent.mock.calls[0][1],
        createAdmission.mock.calls[0][1],
        createEnrollment.mock.calls[0][1],
        transition.mock.calls[0][4],
      ];

      // One client, and it is the one the transaction handed out. A service
      // given the global client instead would commit on its own and survive a
      // rollback of everything around it.
      for (const client of clients) {
        expect(client).toBe(mockPrisma);
        expect(client).toBeDefined();
      }
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('opens exactly one transaction', async () => {
      await conversion.admit('app-1', REQUEST, SCOPE, ACTOR);
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('creates the student from the application, marked as born of admission', async () => {
      await conversion.admit('app-1', REQUEST, SCOPE, ACTOR);

      const input = createStudent.mock.calls[0][0];
      expect(input).toMatchObject({
        organizationId: 'org-1',
        branchId: 'branch-1',
        personId: 'person-1',
        createdVia: 'ADMISSION',
        sourceApplicantId: 'app-1',
      });

      // Nothing that varies with the year: those belong to the enrolment, and
      // a copy here would be stale the first time the student is promoted.
      for (const forbidden of [
        'programId',
        'academicUnitId',
        'academicYearId',
        'rollNumber',
        'aadhaarNo',
        'studentCode',
        'status',
      ]) {
        expect(Object.keys(input)).not.toContain(forbidden);
      }
    });

    it('opens the admission with the applicant’s own quota and source', async () => {
      await conversion.admit('app-1', REQUEST, SCOPE, ACTOR);

      expect(createAdmission.mock.calls[0][0]).toMatchObject({
        organizationId: 'org-1',
        branchId: 'branch-1',
        studentId: 'stu-1',
        admissionType: 'REGULAR',
        entryProgramId: 'prog-1',
        entryAcademicUnitId: 'unit-1',
        quotaId: 'quota-1',
        admissionSourceId: 'source-1',
        sourceApplicantId: 'app-1',
      });
    });

    it('places the student for the year with no roll number', async () => {
      await conversion.admit('app-1', REQUEST, SCOPE, ACTOR);

      const input = createEnrollment.mock.calls[0][0];
      expect(input).toMatchObject({
        admissionId: 'adm-1',
        studentId: 'stu-1',
        academicYearId: 'year-1',
        programId: 'prog-1',
        academicUnitId: 'unit-1',
        originType: 'ADMISSION',
        applicantId: 'app-1',
      });
      // The default policy is manual, and a number invented here is one nobody
      // can explain to the parent who asks about it.
      expect(input.rollNumber).toBeUndefined();
    });

    it('moves the applicant through the machine, last and orchestrated', async () => {
      await conversion.admit('app-1', REQUEST, SCOPE, ACTOR);

      expect(transition).toHaveBeenCalledTimes(1);
      const [applicantId, request] = transition.mock.calls[0];
      expect(applicantId).toBe('app-1');
      expect(request).toMatchObject({
        action: WorkflowAction.ADMIT,
        orchestrated: true,
      });

      // Last, because the status is only true once the three rows exist.
      expect(transition.mock.invocationCallOrder[0]).toBeGreaterThan(
        createEnrollment.mock.invocationCallOrder[0],
      );
    });

    it('never writes a row itself', async () => {
      await conversion.admit('app-1', REQUEST, SCOPE, ACTOR);

      // The orchestrator reads and locks. Every write goes through the service
      // that owns the rules for it.
      for (const model of [
        'applicant',
        'academicUnit',
        'academicYear',
        'student',
      ]) {
        const calls = Object.keys(mockPrisma[model]);
        expect(calls).not.toContain('create');
        expect(calls).not.toContain('update');
      }
    });
  });

  // ---------------------------------------------------------------------------

  describe('eligibility', () => {
    it.each([
      'DRAFT',
      'SUBMITTED',
      'UNDER_REVIEW',
      'DOCUMENT_PENDING',
      'FEE_PENDING',
      'WAITLISTED',
      'APPROVED',
      'DEFERRED',
      'REJECTED',
      'WITHDRAWN',
      'CANCELLED',
    ])('refuses to admit a %s application', async (status) => {
      mockPrisma.applicant.findFirst.mockResolvedValue({
        ...APPLICANT,
        admissionStatus: status,
      });

      await expect(
        conversion.admit('app-1', REQUEST, SCOPE, ACTOR),
      ).rejects.toMatchObject({
        response: { error: 'APPLICANT_NOT_SEAT_CONFIRMED' },
      });

      expect(createStudent).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses an application that is already admitted', async () => {
      mockPrisma.applicant.findFirst.mockResolvedValue({
        ...APPLICANT,
        admissionStatus: 'ADMITTED',
      });

      await expect(
        conversion.admit('app-1', REQUEST, SCOPE, ACTOR),
      ).rejects.toMatchObject({
        response: { error: 'APPLICANT_ALREADY_ADMITTED' },
      });
    });

    /**
     * The read before the transaction is a guess. This is the case the lock
     * exists for: a competing request committed in between.
     */
    it('re-reads the state under the lock and names the winner', async () => {
      lockedAs('ADMITTED');
      mockPrisma.student.findFirst.mockResolvedValue({
        id: 'stu-winner',
        studentCode: 'STU0000000999',
      });

      const caught = await conversion
        .admit('app-1', REQUEST, SCOPE, ACTOR)
        .catch((e: unknown) => e);

      expect(errorCode(caught)).toBe('APPLICANT_ALREADY_ADMITTED');
      // Enough for a client to treat the conflict as the completed operation
      // it is, and nothing about the person behind it.
      expect(
        (caught as { response: Record<string, unknown> }).response,
      ).toMatchObject({
        studentId: 'stu-winner',
        studentCode: 'STU0000000999',
      });
      expect(createStudent).not.toHaveBeenCalled();
    });

    it('fails safely when the lock finds the state has moved sideways', async () => {
      lockedAs('CANCELLED');

      await expect(
        conversion.admit('app-1', REQUEST, SCOPE, ACTOR),
      ).rejects.toMatchObject({
        response: {
          error: 'APPLICANT_NOT_SEAT_CONFIRMED',
          currentStatus: 'CANCELLED',
        },
      });
      expect(createStudent).not.toHaveBeenCalled();
    });

    it('treats a soft-deleted applicant as absent', async () => {
      lockedAs('SEAT_CONFIRMED', { deletedAt: new Date() });

      await expect(
        conversion.admit('app-1', REQUEST, SCOPE, ACTOR),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('the readmission boundary', () => {
    it('refuses when the person is already a student here', async () => {
      mockPrisma.student.findFirst.mockResolvedValue({
        id: 'stu-existing',
        studentCode: 'STU0000000042',
        status: 'WITHDRAWN',
      });

      const caught = await conversion
        .admit('app-1', REQUEST, SCOPE, ACTOR)
        .catch((e: unknown) => e);

      // Reusing the identity and opening a second spell of study is
      // readmission, which closes the previous one, needs an elevated
      // permission for an expelled student and records a mandatory reason.
      // A partial version of it under another name would be worse than none.
      expect(errorCode(caught)).toBe('STUDENT_ALREADY_EXISTS');
      expect(
        (caught as { response: Record<string, unknown> }).response,
      ).toMatchObject({
        studentId: 'stu-existing',
        studentCode: 'STU0000000042',
      });

      expect(createStudent).not.toHaveBeenCalled();
      expect(createAdmission).not.toHaveBeenCalled();
      expect(createEnrollment).not.toHaveBeenCalled();
      expect(transition).not.toHaveBeenCalled();
    });

    it.each(['READMISSION', 'BRANCH_TRANSFER', 'TRANSFER', 'MIGRATION'])(
      'refuses %s as an admission type',
      async (admissionType) => {
        await expect(
          conversion.admit(
            'app-1',
            { ...REQUEST, admissionType: admissionType as never },
            SCOPE,
            ACTOR,
          ),
        ).rejects.toMatchObject({
          response: { error: 'ADMISSION_TYPE_NOT_A_FIRST_ENTRY' },
        });
      },
    );

    it.each(['REGULAR', 'LATERAL_ENTRY', 'RTE'])(
      'accepts %s as a first entry',
      async (admissionType) => {
        await expect(
          conversion.admit(
            'app-1',
            { ...REQUEST, admissionType: admissionType as never },
            SCOPE,
            ACTOR,
          ),
        ).resolves.toBeDefined();
        expect(createAdmission.mock.calls[0][0].admissionType).toBe(
          admissionType,
        );
      },
    );
  });

  // ---------------------------------------------------------------------------

  describe('placement', () => {
    it('takes the programme from the applicant, not the caller', async () => {
      await conversion.admit(
        'app-1',
        { ...REQUEST, programId: 'prog-hijack' } as never,
        SCOPE,
        ACTOR,
      );

      // The programme was offered and confirmed earlier in the funnel. It is
      // not the caller's to change at the moment of admission.
      expect(createAdmission.mock.calls[0][0].entryProgramId).toBe('prog-1');
      expect(createEnrollment.mock.calls[0][0].programId).toBe('prog-1');
    });

    it.each([
      ['branchId', 'branch-2'],
      ['academicYearId', 'year-2'],
      ['programId', 'prog-2'],
    ])('refuses a unit whose %s does not match', async (field, value) => {
      mockPrisma.academicUnit.findFirst.mockResolvedValue({
        ...UNIT,
        [field]: value,
      });

      await expect(
        conversion.admit('app-1', REQUEST, SCOPE, ACTOR),
      ).rejects.toMatchObject({
        response: { error: 'ACADEMIC_UNIT_MISMATCH' },
      });

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses an inactive unit', async () => {
      mockPrisma.academicUnit.findFirst.mockResolvedValue({
        ...UNIT,
        isActive: false,
      });

      await expect(
        conversion.admit('app-1', REQUEST, SCOPE, ACTOR),
      ).rejects.toMatchObject({
        response: { error: 'ACADEMIC_UNIT_INACTIVE' },
      });
    });

    it('refuses a unit that does not exist', async () => {
      mockPrisma.academicUnit.findFirst.mockResolvedValue(null);

      await expect(
        conversion.admit('app-1', REQUEST, SCOPE, ACTOR),
      ).rejects.toThrow(NotFoundException);
    });

    it('refuses an application with no programme', async () => {
      mockPrisma.applicant.findFirst.mockResolvedValue({
        ...APPLICANT,
        programId: null,
      });

      await expect(
        conversion.admit('app-1', REQUEST, SCOPE, ACTOR),
      ).rejects.toMatchObject({ response: { error: 'PROGRAM_REQUIRED' } });
    });

    it('refuses a locked academic year', async () => {
      mockPrisma.academicYear.findFirst.mockResolvedValue({
        id: 'year-1',
        isLocked: true,
        branchId: 'branch-1',
      });

      await expect(
        conversion.admit('app-1', REQUEST, SCOPE, ACTOR),
      ).rejects.toMatchObject({ response: { error: 'ACADEMIC_YEAR_LOCKED' } });

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('provisioning', () => {
    it.each([
      [['ADMISSION_NO'], ['STUDENT_CODE']],
      [['STUDENT_CODE'], ['ADMISSION_NO']],
      [[], ['STUDENT_CODE', 'ADMISSION_NO']],
    ])(
      'refuses when %s is the only sequence configured',
      async (present, missing) => {
        mockPrisma.numberSequenceConfig.findMany.mockResolvedValue(
          present.map((purpose) => ({ purpose })),
        );

        const caught = await conversion
          .admit('app-1', REQUEST, SCOPE, ACTOR)
          .catch((e: unknown) => e);

        // A missing sequence is a tenant-onboarding failure. Minting a code from
        // an invented default puts a permanent identifier in the wrong format on
        // an ID card before anyone notices.
        expect(errorCode(caught)).toBe('NUMBERING_NOT_PROVISIONED');
        expect(
          (caught as { response: { missing: string[] } }).response.missing,
        ).toEqual(missing);
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      },
    );
  });

  // ---------------------------------------------------------------------------

  describe('identity', () => {
    /**
     * The regression this section exists for.
     *
     * Submission places the applicant in the identity index. Asking again here
     * asks the same question twice, and for anyone without a government
     * identifier the second answer differs — demographic matching deliberately
     * never merges, because twins share every demographic signal. The result
     * was two Person rows for one human, the Applicant pointing at the first
     * and the Student at the second.
     */
    it('reuses the Person the application already resolved', async () => {
      await conversion.admit('app-1', REQUEST, SCOPE, ACTOR);

      expect(resolvePerson).not.toHaveBeenCalled();
      expect(createStudent.mock.calls[0][0].personId).toBe('person-1');
      expect(mockPrisma.student.findFirst.mock.calls[0][0].where).toEqual({
        organizationId: 'org-1',
        personId: 'person-1',
      });
    });

    it('reads the person from the locked row, not the earlier read', async () => {
      // The pre-transaction read is a guess; submission may have committed a
      // person between it and the lock.
      mockPrisma.applicant.findFirst.mockResolvedValue({
        ...APPLICANT,
        personId: null,
      });
      lockedAs('SEAT_CONFIRMED', { personId: 'person-committed-late' });

      await conversion.admit('app-1', REQUEST, SCOPE, ACTOR);

      expect(resolvePerson).not.toHaveBeenCalled();
      expect(createStudent.mock.calls[0][0].personId).toBe(
        'person-committed-late',
      );
    });

    it('resolves only for a row that predates the identity index', async () => {
      lockedAs('SEAT_CONFIRMED', { personId: null });

      await conversion.admit('app-1', REQUEST, SCOPE, ACTOR);

      // The grandfathered case: an applicant that reached SUBMITTED before
      // Person existed. Resolution is delegated, government identifier and all.
      expect(resolvePerson).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({
          firstName: 'Riya',
          lastName: 'Sharma',
          governmentId: '234567890123',
        }),
        mockPrisma,
      );
      expect(createStudent.mock.calls[0][0].personId).toBe('person-1');
    });

    it('propagates a failure resolving a legacy row', async () => {
      lockedAs('SEAT_CONFIRMED', { personId: null });
      resolvePerson.mockRejectedValueOnce(new Error('injected failure'));

      await expect(
        conversion.admit('app-1', REQUEST, SCOPE, ACTOR),
      ).rejects.toThrow('injected failure');
      expect(createStudent).not.toHaveBeenCalled();
    });

    it('does no matching of its own', async () => {
      await conversion.admit('app-1', REQUEST, SCOPE, ACTOR);

      // Admissions never queries Person directly. A second implementation of
      // "same human" would drift from the one that decides it.
      expect(Object.keys(mockPrisma)).not.toContain('person');
    });

    it('keeps the government identifier out of every downstream call', async () => {
      await conversion.admit('app-1', REQUEST, SCOPE, ACTOR);

      const payloads = [
        createStudent.mock.calls[0][0],
        createAdmission.mock.calls[0][0],
        createEnrollment.mock.calls[0][0],
      ];

      for (const payload of payloads) {
        expect(JSON.stringify(payload)).not.toContain('234567890123');
        expect(Object.keys(payload)).not.toContain('aadhaarNo');
        expect(Object.keys(payload)).not.toContain('governmentId');
      }
    });

    it('admits a legacy applicant with no government identifier', async () => {
      mockPrisma.applicant.findFirst.mockResolvedValue({
        ...APPLICANT,
        aadhaarNo: null,
      });
      lockedAs('SEAT_CONFIRMED', { personId: null });

      await expect(
        conversion.admit('app-1', REQUEST, SCOPE, ACTOR),
      ).resolves.toBeDefined();
      expect(resolvePerson.mock.calls[0][1].governmentId).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------

  describe('security', () => {
    it('treats an out-of-scope applicant as absent', async () => {
      mockPrisma.applicant.findFirst.mockResolvedValue(null);

      await expect(
        conversion.admit('app-1', REQUEST, OTHER_BRANCH, ACTOR),
      ).rejects.toThrow(NotFoundException);
    });

    it('scopes the lookup by organization and branch', async () => {
      await conversion.admit('app-1', REQUEST, SCOPE, ACTOR);

      expect(
        mockPrisma.applicant.findFirst.mock.calls[0][0].where,
      ).toMatchObject({
        id: 'app-1',
        organizationId: 'org-1',
        branchId: 'branch-1',
        deletedAt: null,
      });
    });

    it('requires both approving and student-creating permissions', async () => {
      await conversion.admit('app-1', REQUEST, SCOPE, ACTOR);

      expect(hasPermission.mock.calls.map((c) => c[2])).toEqual([
        'admissions.approve',
        'student.create',
      ]);
    });

    it.each([
      ['admissions.approve', 0],
      ['student.create', 1],
    ])('refuses an actor missing %s', async (_permission, index) => {
      hasPermission.mockImplementation((_u: string, _r: string, name: string) =>
        Promise.resolve(
          name !== ['admissions.approve', 'student.create'][index],
        ),
      );

      await expect(
        conversion.admit('app-1', REQUEST, SCOPE, ACTOR),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses an anonymous caller', async () => {
      await expect(
        conversion.admit('app-1', REQUEST, SCOPE, { userId: null, role: null }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('populates scope from the applicant, never from the caller context', async () => {
      // A caller whose context somehow named another branch cannot move the
      // student there: every id written comes from the applicant's own row.
      await conversion.admit('app-1', REQUEST, SCOPE, ACTOR);

      for (const input of [
        createStudent.mock.calls[0][0],
        createAdmission.mock.calls[0][0],
        createEnrollment.mock.calls[0][0],
      ]) {
        expect(input.organizationId).toBe(APPLICANT.organizationId);
        expect(input.branchId).toBe(APPLICANT.branchId);
      }
    });
  });

  // ---------------------------------------------------------------------------

  describe('failure rolls everything back', () => {
    const steps: Array<[string, jest.Mock]> = [
      ['student creation', createStudent],
      ['admission creation', createAdmission],
      ['enrollment creation', createEnrollment],
      ['the applicant transition', transition],
    ];

    it.each(steps)('propagates a failure in %s', async (_name, step) => {
      step.mockRejectedValueOnce(new Error('injected failure'));

      await expect(
        conversion.admit('app-1', REQUEST, SCOPE, ACTOR),
      ).rejects.toThrow('injected failure');

      // Nothing is caught and swallowed: the rejection reaches the transaction
      // boundary, which is what makes Prisma roll the whole thing back.
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('translates a duplicate applicant into a named conflict', async () => {
      const { Prisma } = await import('@/generated/client');
      createStudent.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('unique', {
          code: 'P2002',
          clientVersion: 'test',
          meta: { target: 'sourceApplicantId' },
        }),
      );

      const caught = await conversion
        .admit('app-1', REQUEST, SCOPE, ACTOR)
        .catch((e: unknown) => e);

      expect(errorCode(caught)).toBe('APPLICANT_ALREADY_ADMITTED');
      expect(JSON.stringify(caught)).not.toContain('P2002');
    });

    it('translates a duplicate person into a named conflict', async () => {
      const { Prisma } = await import('@/generated/client');
      createStudent.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('unique', {
          code: 'P2002',
          clientVersion: 'test',
          meta: { target: ['organizationId', 'personId'] },
        }),
      );

      expect(
        errorCode(
          await conversion
            .admit('app-1', REQUEST, SCOPE, ACTOR)
            .catch((e) => e),
        ),
      ).toBe('STUDENT_ALREADY_EXISTS');
    });
  });

  describe('what it refuses to do', () => {
    it('exposes only admit', () => {
      const surface = Object.getOwnPropertyNames(
        Object.getPrototypeOf(conversion),
      ).filter((name) => name !== 'constructor' && !name.startsWith('_'));

      // Everything else is private. Readmission, transfer and promotion are
      // separate operations and must not appear here by accident.
      expect(surface.filter((name) => !name.startsWith('assert'))).toEqual(
        expect.arrayContaining(['admit']),
      );
      for (const forbidden of ['readmit', 'transfer', 'promote', 'merge']) {
        expect(surface).not.toContain(forbidden);
      }
    });
  });
});
