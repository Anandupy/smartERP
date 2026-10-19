import { Test, TestingModule } from '@nestjs/testing';
import { ConfigScope } from '@/generated/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { AppModule } from '@/app.module';
import { ApplicantService } from '@/modules/admissions/applicant/applicant.service';
import { WorkflowService } from '@/modules/admissions/workflow/workflow.service';
import { WorkflowAction } from '@/modules/admissions/workflow/workflow.transitions';
import { AdmissionConversionService } from '@/modules/admissions/admission/admission-conversion.service';
import { StudentService } from '@/modules/identity/student/student.service';
import { NumberingService } from '@/infrastructure/numbering/numbering.service';
import { ConfigurationService } from '@/modules/configuration/configuration.service';
import { ADMISSION_CONFIG_KEYS } from '@/modules/configuration/config.registry';
import { ResourceScope } from '@/common/scope/resource-scope';

/**
 * Configurable admission workflows, against real Postgres.
 *
 * Four branches of one organization, each on a different profile:
 * A and D SIMPLE_ADMISSION, B VERIFIED_ADMISSION, C the STANDARD default.
 * The point of every SIMPLE test is that direct admission is the ordinary
 * engine run end to end in one transaction — so each failure is checked to
 * leave the applicant exactly as it was found.
 */
describe('Configurable admission workflows (integration)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let applicants: ApplicantService;
  let workflow: WorkflowService;
  let conversion: AdmissionConversionService;
  let configuration: ConfigurationService;
  let numbering: NumberingService;

  const suffix = Date.now().toString();
  let seq = 0;

  let orgId: string;
  let otherOrgId: string;
  const branch: Record<'A' | 'B' | 'C' | 'D', string> = {} as never;
  const year: Record<'A' | 'B' | 'C' | 'D', string> = {} as never;
  const program: Record<'A' | 'B' | 'C' | 'D', string> = {} as never;
  const unit: Record<'A' | 'B' | 'C' | 'D', string> = {} as never;
  let genderId: string;
  let documentTypeId: string;
  let otherOrgDocumentTypeId: string;

  const scope = (b: 'A' | 'B' | 'C' | 'D'): ResourceScope => ({
    organizationId: orgId,
    branchId: branch[b],
    academicYearId: year[b],
  });

  const ADMIN = {
    userId: '00000000-0000-4000-8000-00000000c0a1',
    role: 'SUPER_ADMIN',
  };
  const REVIEWER = {
    userId: '00000000-0000-4000-8000-00000000c0a2',
    role: 'SUPER_ADMIN',
  };
  const STAFF = {
    userId: '00000000-0000-4000-8000-00000000c0a3',
    role: 'STAFF',
  };

  const errorCode = (e: unknown) =>
    (e as { response?: { error?: string } })?.response?.error;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    await moduleRef.init();

    prisma = moduleRef.get(PrismaService);
    applicants = moduleRef.get(ApplicantService);
    workflow = moduleRef.get(WorkflowService);
    conversion = moduleRef.get(AdmissionConversionService);
    configuration = moduleRef.get(ConfigurationService);
    numbering = moduleRef.get(NumberingService);

    const makeOrg = async (label: string) =>
      (
        await prisma.organization.create({
          data: {
            name: `CW ${label}`,
            code: `CW${label}_${suffix}`,
            contactEmail: 'cw@test.local',
            contactPhone: '1234567890',
            masterExpiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          },
        })
      ).id;

    orgId = await makeOrg('ORG');
    otherOrgId = await makeOrg('OTH');

    for (const b of ['A', 'B', 'C', 'D'] as const) {
      branch[b] = (
        await prisma.branch.create({
          data: {
            organizationId: orgId,
            name: `CW Branch ${b}`,
            code: `CWB${b}_${suffix}`,
            institutionType: 'SCHOOL',
            contactEmail: 'b@test.local',
            contactPhone: '1234567890',
            addressLine1: 'Road 1',
            city: 'Pune',
            state: 'MH',
            country: 'IN',
            pincode: '411001',
          },
        })
      ).id;
      year[b] = (
        await prisma.academicYear.create({
          data: {
            branchId: branch[b],
            name: `2026-2027 ${b} ${suffix}`,
            startDate: new Date('2026-04-01'),
            endDate: new Date('2027-03-31'),
          },
        })
      ).id;
      program[b] = (
        await prisma.program.create({
          data: { branchId: branch[b], name: `Std 1 ${b} ${suffix}` },
        })
      ).id;
      unit[b] = (
        await prisma.academicUnit.create({
          data: {
            branchId: branch[b],
            programId: program[b],
            academicYearId: year[b],
            name: `Std 1-${b}`,
            unitType: 'SECTION',
            level: 1,
          },
        })
      ).id;

      for (const purpose of [
        'ADMISSION_FORM',
        'APPLICATION',
        'ADMISSION_NO',
      ] as const) {
        await numbering.createConfig(
          {
            purpose,
            prefix: purpose === 'ADMISSION_NO' ? `AD${b}` : `AP${b}`,
            sequencePadding: 5,
            format: '{prefix}-{year}-{sequence}',
          },
          orgId,
          branch[b],
        );
      }
    }
    await numbering.createConfig(
      {
        purpose: 'STUDENT_CODE',
        prefix: 'CWS',
        sequencePadding: 10,
        format: '{prefix}{sequence}',
      },
      orgId,
      null,
    );

    genderId = (
      await prisma.gender.create({
        data: {
          organizationId: orgId,
          code: `CWG_${suffix}`,
          name: `G ${suffix}`,
        },
      })
    ).id;

    documentTypeId = (
      await prisma.documentType.create({
        data: {
          organizationId: orgId,
          code: `CW_TC_${suffix}`,
          name: 'Transfer certificate',
          allowedMimeTypes: ['application/pdf'],
        },
      })
    ).id;
    otherOrgDocumentTypeId = (
      await prisma.documentType.create({
        data: {
          organizationId: otherOrgId,
          code: `CW_OTH_${suffix}`,
          name: 'Other org certificate',
          allowedMimeTypes: ['application/pdf'],
        },
      })
    ).id;

    await setBranch(
      'A',
      ADMISSION_CONFIG_KEYS.workflowProfile,
      'SIMPLE_ADMISSION',
    );
    await setBranch(
      'D',
      ADMISSION_CONFIG_KEYS.workflowProfile,
      'SIMPLE_ADMISSION',
    );
    await setBranch(
      'B',
      ADMISSION_CONFIG_KEYS.workflowProfile,
      'VERIFIED_ADMISSION',
    );
  });

  afterAll(async () => {
    const scopeIds = [orgId, otherOrgId, ...Object.values(branch)];
    await prisma.configValue.deleteMany({
      where: { scopeId: { in: scopeIds } },
    });

    for (const org of [orgId, otherOrgId]) {
      await prisma.documentRequirement.deleteMany({
        where: { organizationId: org },
      });
      await prisma.documentType.deleteMany({ where: { organizationId: org } });
      await prisma.auditLog.deleteMany({ where: { organizationId: org } });
      await prisma.outboxEvent.deleteMany({ where: { organizationId: org } });
      await prisma.workflowHistory.deleteMany({
        where: { organizationId: org },
      });
      await prisma.enrollment.updateMany({
        where: { organizationId: org },
        data: {
          enrollmentStatus: 'CANCELLED',
          originType: 'ADMISSION',
          supersededById: null,
          previousEnrollmentId: null,
          changeReason: null,
          exitDate: new Date(),
          exitReason: 'CANCELLED_BEFORE_JOINING',
        },
      });
      await prisma.enrollment.deleteMany({ where: { organizationId: org } });
      await prisma.admission.updateMany({
        where: { organizationId: org },
        data: { previousAdmissionId: null, sourceApplicantId: null },
      });
      await prisma.admission.deleteMany({ where: { organizationId: org } });
      await prisma.student.updateMany({
        where: { organizationId: org },
        data: { createdVia: 'MIGRATION', sourceApplicantId: null },
      });
      await prisma.applicant.deleteMany({ where: { organizationId: org } });
      await prisma.student.deleteMany({ where: { organizationId: org } });
      await prisma.personSensitive.deleteMany({
        where: { person: { organizationId: org } },
      });
      await prisma.person.deleteMany({ where: { organizationId: org } });
      await prisma.organizationDataKey.deleteMany({
        where: { organizationId: org },
      });
      await prisma.numberSequenceCounter.deleteMany({
        where: { config: { organizationId: org } },
      });
      await prisma.numberSequenceConfig.deleteMany({
        where: { organizationId: org },
      });
      await prisma.academicUnit.deleteMany({
        where: { branch: { organizationId: org } },
      });
      await prisma.program.deleteMany({
        where: { branch: { organizationId: org } },
      });
      await prisma.academicYear.deleteMany({
        where: { branch: { organizationId: org } },
      });
      await prisma.gender.deleteMany({ where: { organizationId: org } });
      await prisma.branch.deleteMany({ where: { organizationId: org } });
      await prisma.organization.deleteMany({ where: { id: org } });
    }
    await moduleRef.close();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await prisma.academicYear.updateMany({
      where: { id: { in: Object.values(year) } },
      data: { isLocked: false },
    });
    await prisma.documentRequirement.updateMany({
      where: { organizationId: { in: [orgId, otherOrgId] } },
      data: { isActive: false, deletedAt: new Date() },
    });
  });

  // ---------------------------------------------------------------------------
  // Fixtures
  // ---------------------------------------------------------------------------

  function setBranch(b: 'A' | 'B' | 'C' | 'D', key: string, value: unknown) {
    return configuration.set(
      key,
      { scopeType: ConfigScope.BRANCH, scopeId: branch[b] },
      value,
      'integration test',
      ADMIN,
    );
  }

  function clearBranch(b: 'A' | 'B' | 'C' | 'D', key: string) {
    return configuration.clear(
      key,
      { scopeType: ConfigScope.BRANCH, scopeId: branch[b] },
      'integration test',
      ADMIN,
    );
  }

  function aadhaar(): string {
    seq += 1;
    return `3${String((Date.now() + seq) % 100000000).padStart(8, '0')}${String(
      seq % 1000,
    ).padStart(3, '0')}`.slice(0, 12);
  }

  async function draft(
    b: 'A' | 'B' | 'C' | 'D',
    options: { aadhaarNo?: string } = {},
  ) {
    seq += 1;
    const { applicant } = await applicants.create(
      {
        firstName: 'Aarav',
        lastName: `Kulkarni${suffix}${seq}`,
        dob: '2016-06-01',
        genderId,
        programId: program[b],
        aadhaarNo: options.aadhaarNo ?? aadhaar(),
        primaryMobile: `8${String(seq).padStart(9, '0')}`,
        currentAddressLine1: 'Lane 2',
        city: 'Pune',
        state: 'MH',
        country: 'IN',
        pincode: '411001',
      } as never,
      scope(b),
    );
    return applicant;
  }

  const directAdmit = (
    applicantId: string,
    b: 'A' | 'B' | 'C' | 'D' = 'A',
    actor = ADMIN,
    overrides: Record<string, unknown> = {},
  ) =>
    conversion.directAdmit(
      applicantId,
      { academicUnitId: unit[b], ...overrides } as never,
      scope(b),
      actor,
    );

  const act = (
    applicantId: string,
    b: 'A' | 'B' | 'C' | 'D',
    action: WorkflowAction,
    actor = ADMIN,
    remarks?: string,
  ) => workflow.transition(applicantId, { action, remarks }, scope(b), actor);

  async function footprint(applicantId: string) {
    const [applicant, students, admissions, enrollments, history, events] =
      await Promise.all([
        prisma.applicant.findUniqueOrThrow({ where: { id: applicantId } }),
        prisma.student.count({ where: { sourceApplicantId: applicantId } }),
        prisma.admission.count({ where: { sourceApplicantId: applicantId } }),
        prisma.enrollment.count({ where: { applicantId } }),
        prisma.workflowHistory.count({ where: { entityId: applicantId } }),
        prisma.outboxEvent.count({
          where: {
            aggregateId: applicantId,
            eventName: { startsWith: 'applicant.', not: 'applicant.created' },
          },
        }),
      ]);
    return {
      status: applicant.admissionStatus,
      students,
      admissions,
      enrollments,
      history,
      events,
    };
  }

  const UNTOUCHED_DRAFT = {
    status: 'DRAFT',
    students: 0,
    admissions: 0,
    enrollments: 0,
    history: 0,
    events: 0,
  };

  async function requireDocument(
    stage: 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED',
    branchId: string | null,
    organizationId = orgId,
    typeId = documentTypeId,
  ) {
    return prisma.documentRequirement.create({
      data: {
        organizationId,
        branchId,
        documentTypeId: typeId,
        requiredByStage: stage,
        isMandatory: true,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // F2 configuration core
  // ---------------------------------------------------------------------------

  describe('configuration resolution', () => {
    it('resolves the STANDARD default where nothing is set', async () => {
      const policy = await workflow.policyFor(scope('C'), null);
      expect(policy.workflowProfile).toBe('STANDARD_ADMISSION');
      expect(policy.sources.workflowProfile).toBe('DEFAULT');
      expect(policy.offerValidityDays).toBe(15);
      expect(policy.allowDeferment).toBe(false);
    });

    it('applies an organization value, and a branch value overrides it', async () => {
      await configuration.set(
        ADMISSION_CONFIG_KEYS.offerValidityDays,
        { scopeType: ConfigScope.ORGANIZATION, scopeId: orgId },
        21,
        'org policy',
        ADMIN,
      );
      await setBranch('C', ADMISSION_CONFIG_KEYS.offerValidityDays, 7);

      const c = await workflow.policyFor(scope('C'), null);
      const b = await workflow.policyFor(scope('B'), null);
      expect(c.offerValidityDays).toBe(7);
      expect(c.sources.offerValidityDays).toBe('BRANCH');
      expect(b.offerValidityDays).toBe(21);
      expect(b.sources.offerValidityDays).toBe('ORGANIZATION');

      await clearBranch('C', ADMISSION_CONFIG_KEYS.offerValidityDays);
      expect(
        (await workflow.policyFor(scope('C'), null)).offerValidityDays,
      ).toBe(21);

      await configuration.clear(
        ADMISSION_CONFIG_KEYS.offerValidityDays,
        { scopeType: ConfigScope.ORGANIZATION, scopeId: orgId },
        'reset',
        ADMIN,
      );
      expect(
        (await workflow.policyFor(scope('C'), null)).offerValidityDays,
      ).toBe(15);
    });

    it('answers what the rule was at an earlier instant', async () => {
      const before = new Date();
      await new Promise((r) => setTimeout(r, 5));
      await setBranch('C', ADMISSION_CONFIG_KEYS.allowDeferment, true);

      expect(
        (await workflow.policyFor(scope('C'), before)).allowDeferment,
      ).toBe(false);
      expect((await workflow.policyFor(scope('C'), null)).allowDeferment).toBe(
        true,
      );

      await clearBranch('C', ADMISSION_CONFIG_KEYS.allowDeferment);
    });

    it('keeps an append-only history with versions and reasons', async () => {
      await setBranch('C', ADMISSION_CONFIG_KEYS.waitlistEnabled, false);
      await setBranch('C', ADMISSION_CONFIG_KEYS.waitlistEnabled, true);

      const history = await configuration.history(
        ADMISSION_CONFIG_KEYS.waitlistEnabled,
        { scopeType: ConfigScope.BRANCH, scopeId: branch.C },
      );
      expect(history.map((h) => h.version)).toEqual([2, 1]);
      expect(history[0].effectiveTo).toBeNull();
      expect(history[1].effectiveTo!.getTime()).toBe(
        history[0].effectiveFrom.getTime(),
      );
      expect(history.every((h) => h.reason === 'integration test')).toBe(true);

      await clearBranch('C', ADMISSION_CONFIG_KEYS.waitlistEnabled);
    });

    it('refuses an invalid value, a missing reason, and an unknown key', async () => {
      await expect(
        setBranch('C', ADMISSION_CONFIG_KEYS.workflowProfile, 'ANYTHING_GOES'),
      ).rejects.toMatchObject({ response: { error: 'CONFIG_VALUE_INVALID' } });
      await expect(
        setBranch('C', ADMISSION_CONFIG_KEYS.offerValidityDays, -5),
      ).rejects.toMatchObject({ response: { error: 'CONFIG_VALUE_INVALID' } });
      await expect(
        configuration.set(
          ADMISSION_CONFIG_KEYS.workflowProfile,
          { scopeType: ConfigScope.BRANCH, scopeId: branch.C },
          'SIMPLE_ADMISSION',
          '   ',
          ADMIN,
        ),
      ).rejects.toMatchObject({
        response: { error: 'CONFIG_REASON_REQUIRED' },
      });
      await expect(
        configuration.set(
          'admissions.made_up',
          { scopeType: ConfigScope.BRANCH, scopeId: branch.C },
          true,
          'x',
          ADMIN,
        ),
      ).rejects.toMatchObject({ response: { error: 'CONFIG_KEY_NOT_FOUND' } });
    });

    it('lets only a super administrator set the platform default', async () => {
      await expect(
        configuration.set(
          ADMISSION_CONFIG_KEYS.workflowProfile,
          { scopeType: ConfigScope.SYSTEM, scopeId: null },
          'SIMPLE_ADMISSION',
          'x',
          { userId: STAFF.userId, role: 'ORG_ADMIN' },
        ),
      ).rejects.toMatchObject({ status: 403 });
    });

    it('refuses a write by a role without the category permission', async () => {
      await expect(
        configuration.set(
          ADMISSION_CONFIG_KEYS.workflowProfile,
          { scopeType: ConfigScope.BRANCH, scopeId: branch.C },
          'SIMPLE_ADMISSION',
          'x',
          STAFF,
        ),
      ).rejects.toMatchObject({ status: 403 });
    });

    it('fails closed on a corrupted stored value instead of falling back', async () => {
      await prisma.configValue.create({
        data: {
          definitionKey: ADMISSION_CONFIG_KEYS.workflowProfile,
          scopeType: ConfigScope.ORGANIZATION,
          scopeId: otherOrgId,
          value: 'NOT_A_PROFILE',
          version: 1,
        },
      });

      await expect(
        workflow.policyFor(
          {
            organizationId: otherOrgId,
            branchId: null,
            academicYearId: null,
          } as never,
          null,
        ),
      ).rejects.toMatchObject({ response: { error: 'CONFIGURATION_INVALID' } });

      await prisma.configValue.deleteMany({ where: { scopeId: otherOrgId } });
    });

    describe('database invariants (raw SQL)', () => {
      const insert = (
        scopeType: string,
        scopeId: string | null,
        from: string,
        to: string | null,
      ) =>
        prisma.$executeRawUnsafe(
          `INSERT INTO "ConfigValue" ("id","definitionKey","scopeType","scopeId","value","effectiveFrom","effectiveTo","version","setAt")
           VALUES (gen_random_uuid()::text, $1, $2::"ConfigScope", $3, '"STANDARD_ADMISSION"'::jsonb, $4::timestamp, $5::timestamp, 1, now())`,
          ADMISSION_CONFIG_KEYS.workflowProfile,
          scopeType,
          scopeId,
          from,
          to,
        );

      afterEach(() =>
        prisma.configValue.deleteMany({ where: { scopeId: otherOrgId } }),
      );

      it('refuses two current values for one key and scope', async () => {
        await insert('ORGANIZATION', otherOrgId, '2026-01-01', null);
        await expect(
          insert('ORGANIZATION', otherOrgId, '2026-02-01', null),
        ).rejects.toThrow();
      });

      it('refuses overlapping windows, closed ones included', async () => {
        await insert('ORGANIZATION', otherOrgId, '2026-01-01', '2026-03-01');
        await expect(
          insert('ORGANIZATION', otherOrgId, '2026-02-01', '2026-04-01'),
        ).rejects.toThrow();
      });

      it('refuses a BRANCH value without a scope id', async () => {
        await expect(
          insert('BRANCH', null, '2026-01-01', null),
        ).rejects.toThrow();
      });

      it('refuses an unordered window', async () => {
        await expect(
          insert('ORGANIZATION', otherOrgId, '2026-03-01', '2026-01-01'),
        ).rejects.toThrow();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // SIMPLE_ADMISSION
  // ---------------------------------------------------------------------------

  describe('SIMPLE_ADMISSION — direct admission', () => {
    it('takes a draft to ADMITTED through every ordinary step, in one transaction', async () => {
      const applicant = await draft('A');

      const result = await directAdmit(applicant.id, 'A', ADMIN, {
        remarks: 'walk-in admission',
      });

      expect(result.walked).toEqual([
        'submit',
        'startReview',
        'approve',
        'confirmSeat',
      ]);
      expect(result.studentCode).toMatch(/^CWS\d{10}$/);
      expect(result.admissionNo).toMatch(/^ADA-/);

      const row = await prisma.applicant.findUniqueOrThrow({
        where: { id: applicant.id },
      });
      expect(row.admissionStatus).toBe('ADMITTED');
      expect(row.personId).not.toBeNull();
      expect(row.submittedAt).not.toBeNull();
      expect(row.approvedBy).toBe(ADMIN.userId);
      expect(row.offerIssuedAt).not.toBeNull();
      expect(row.seatConfirmedAt).not.toBeNull();

      const student = await prisma.student.findUniqueOrThrow({
        where: { id: result.studentId },
      });
      expect(student.personId).toBe(row.personId);
      expect(student.sourceApplicantId).toBe(applicant.id);

      const enrollment = await prisma.enrollment.findUniqueOrThrow({
        where: { id: result.enrollmentId },
      });
      expect(enrollment.academicUnitId).toBe(unit.A);
      expect(enrollment.admissionId).toBe(result.admissionId);

      const history = await prisma.workflowHistory.findMany({
        where: { entityId: applicant.id },
        orderBy: { timestamp: 'asc' },
      });
      expect(history.map((h) => h.actionType)).toEqual([
        'submit',
        'startReview',
        'approve',
        'confirmSeat',
        'admit',
      ]);
      expect(
        history
          .slice(0, 4)
          .every(
            (h) => h.remarks === 'Recorded as part of a direct admission.',
          ),
      ).toBe(true);
      expect(history[4].remarks).toBe('walk-in admission');

      const events = await prisma.outboxEvent.findMany({
        where: {
          aggregateId: applicant.id,
          eventName: { not: 'applicant.created' },
        },
        orderBy: { occurredAt: 'asc' },
      });
      expect(events.map((e) => e.eventName)).toEqual(
        expect.arrayContaining([
          'applicant.submitted',
          'applicant.review_started',
          'applicant.offer_issued',
          'applicant.seat_confirmed',
          'applicant.admitted',
        ]),
      );
      const applicantEvents = events.filter(
        (e) => e.aggregateType === 'Applicant',
      );
      expect(applicantEvents).toHaveLength(5);
      expect(
        applicantEvents.every(
          (e) =>
            (e.payload as { orchestration?: string }).orchestration ===
            'DIRECT_ADMISSION',
        ),
      ).toBe(true);
    });

    it('finishes a partly walked application from where it stands', async () => {
      const applicant = await draft('A');
      await act(applicant.id, 'A', WorkflowAction.SUBMIT);
      await act(applicant.id, 'A', WorkflowAction.START_REVIEW);

      const result = await directAdmit(applicant.id);
      expect(result.walked).toEqual(['approve', 'confirmSeat']);
    });

    it('rolls everything back when a mandatory document is missing', async () => {
      await requireDocument('SUBMITTED', branch.A);
      const applicant = await draft('A');

      await expect(directAdmit(applicant.id)).rejects.toMatchObject({
        response: { error: 'DOCUMENTS_INCOMPLETE' },
      });
      expect(await footprint(applicant.id)).toEqual(UNTOUCHED_DRAFT);
      expect(
        (
          await prisma.applicant.findUniqueOrThrow({
            where: { id: applicant.id },
          })
        ).personId,
      ).toBeNull();
    });

    it('refuses a placement outside the applicant’s branch and programme, untouched', async () => {
      const applicant = await draft('A');
      await expect(
        directAdmit(applicant.id, 'A', ADMIN, { academicUnitId: unit.C }),
      ).rejects.toMatchObject({
        response: { error: 'ACADEMIC_UNIT_MISMATCH' },
      });
      expect(await footprint(applicant.id)).toEqual(UNTOUCHED_DRAFT);
    });

    it('refuses a locked academic year, untouched', async () => {
      const applicant = await draft('A');
      await prisma.academicYear.update({
        where: { id: year.A },
        data: { isLocked: true },
      });

      await expect(directAdmit(applicant.id)).rejects.toMatchObject({
        response: { error: 'ACADEMIC_YEAR_LOCKED' },
      });
      expect(await footprint(applicant.id)).toEqual(UNTOUCHED_DRAFT);
    });

    it('refuses when numbering is not provisioned, untouched', async () => {
      const applicant = await draft('A');
      await prisma.numberSequenceConfig.updateMany({
        where: {
          organizationId: orgId,
          branchId: branch.A,
          purpose: 'ADMISSION_NO',
        },
        data: { isActive: false },
      });

      try {
        await expect(directAdmit(applicant.id)).rejects.toMatchObject({
          response: { error: 'NUMBERING_NOT_PROVISIONED' },
        });
        expect(await footprint(applicant.id)).toEqual(UNTOUCHED_DRAFT);
      } finally {
        await prisma.numberSequenceConfig.updateMany({
          where: {
            organizationId: orgId,
            branchId: branch.A,
            purpose: 'ADMISSION_NO',
          },
          data: { isActive: true },
        });
      }
    });

    it('rolls back every walked step when the conversion fails', async () => {
      const applicant = await draft('A');
      jest
        .spyOn(moduleRef.get(StudentService), 'createControlled')
        .mockRejectedValueOnce(new Error('injected failure'));

      await expect(directAdmit(applicant.id)).rejects.toThrow(
        'injected failure',
      );
      expect(await footprint(applicant.id)).toEqual(UNTOUCHED_DRAFT);
    });

    it('refuses a person who is already a student, without creating a second', async () => {
      const shared = aadhaar();
      const first = await draft('D', { aadhaarNo: shared });
      await directAdmit(first.id, 'D');

      const second = await draft('A', { aadhaarNo: shared });
      await expect(directAdmit(second.id)).rejects.toMatchObject({
        response: { error: 'STUDENT_ALREADY_EXISTS' },
      });
      expect(await footprint(second.id)).toEqual(UNTOUCHED_DRAFT);
      const person = await prisma.student.findMany({
        where: {
          organizationId: orgId,
          sourceApplicantId: { in: [first.id, second.id] },
        },
      });
      expect(person).toHaveLength(1);
    });

    it('refuses a second live application for the same person, untouched', async () => {
      const shared = aadhaar();
      const first = await draft('A', { aadhaarNo: shared });
      await act(first.id, 'A', WorkflowAction.SUBMIT);
      const second = await draft('A', { aadhaarNo: shared });

      await expect(directAdmit(second.id)).rejects.toMatchObject({
        response: { error: 'DUPLICATE_ACTIVE_APPLICATION' },
      });
      expect(await footprint(second.id)).toEqual(UNTOUCHED_DRAFT);
    });

    it('refuses a caller without every permission the steps need', async () => {
      const applicant = await draft('A');
      await expect(directAdmit(applicant.id, 'A', STAFF)).rejects.toMatchObject(
        {
          status: 403,
        },
      );
      expect(await footprint(applicant.id)).toEqual(UNTOUCHED_DRAFT);
    });

    it('refuses a terminal application', async () => {
      // Submitted first: a DRAFT is not cancelled but deleted
      // (docs/modules/admissions.md §12.8, BP-17).
      const applicant = await draft('A');
      await act(applicant.id, 'A', WorkflowAction.SUBMIT);
      await act(
        applicant.id,
        'A',
        WorkflowAction.CANCEL,
        ADMIN,
        'duplicate form',
      );
      await expect(directAdmit(applicant.id)).rejects.toMatchObject({
        response: { error: 'INVALID_TRANSITION' },
      });
    });

    describe('concurrency', () => {
      it('two simultaneous direct admissions produce one student and one clean conflict', async () => {
        const applicant = await draft('A');
        const results = await Promise.allSettled([
          directAdmit(applicant.id),
          directAdmit(applicant.id),
        ]);

        const fulfilled = results.filter((r) => r.status === 'fulfilled');
        const rejected = results.filter((r) => r.status === 'rejected');
        expect(fulfilled).toHaveLength(1);
        expect(rejected).toHaveLength(1);
        expect(errorCode((rejected[0] as PromiseRejectedResult).reason)).toBe(
          'APPLICANT_ALREADY_ADMITTED',
        );

        const f = await footprint(applicant.id);
        expect(f).toMatchObject({
          status: 'ADMITTED',
          students: 1,
          admissions: 1,
          enrollments: 1,
        });
        expect(
          await prisma.workflowHistory.count({
            where: { entityId: applicant.id, actionType: 'admit' },
          }),
        ).toBe(1);
      });

      it('direct admission racing a cancellation leaves exactly one outcome', async () => {
        const applicant = await draft('A');
        await act(applicant.id, 'A', WorkflowAction.SUBMIT);
        const [admitted, cancelled] = await Promise.allSettled([
          directAdmit(applicant.id),
          act(applicant.id, 'A', WorkflowAction.CANCEL, ADMIN, 'family moved'),
        ]);

        const f = await footprint(applicant.id);
        if (admitted.status === 'fulfilled') {
          expect(cancelled.status).toBe('rejected');
          expect(f).toMatchObject({ status: 'ADMITTED', students: 1 });
        } else {
          expect(cancelled.status).toBe('fulfilled');
          expect(f).toMatchObject({
            status: 'CANCELLED',
            students: 0,
            admissions: 0,
            enrollments: 0,
          });
        }
      });

      it('direct admission racing a manual submit still admits once', async () => {
        const applicant = await draft('A');
        const [admitted] = await Promise.allSettled([
          directAdmit(applicant.id),
          act(applicant.id, 'A', WorkflowAction.SUBMIT),
        ]);

        expect(admitted.status).toBe('fulfilled');
        const f = await footprint(applicant.id);
        expect(f).toMatchObject({ status: 'ADMITTED', students: 1 });
        expect(
          await prisma.workflowHistory.count({
            where: { entityId: applicant.id, actionType: 'submit' },
          }),
        ).toBe(1);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // STANDARD_ADMISSION
  // ---------------------------------------------------------------------------

  describe('STANDARD_ADMISSION — the default', () => {
    it('refuses direct admission and keeps the standard path', async () => {
      const applicant = await draft('C');
      await expect(directAdmit(applicant.id, 'C')).rejects.toMatchObject({
        response: { error: 'WORKFLOW_PROFILE_MISMATCH' },
      });
      expect(await footprint(applicant.id)).toEqual(UNTOUCHED_DRAFT);

      await act(applicant.id, 'C', WorkflowAction.SUBMIT);
      await act(applicant.id, 'C', WorkflowAction.START_REVIEW);
      await act(applicant.id, 'C', WorkflowAction.APPROVE);
      await act(applicant.id, 'C', WorkflowAction.CONFIRM_SEAT);
      const result = await conversion.admit(
        applicant.id,
        { academicUnitId: unit.C } as never,
        scope('C'),
        ADMIN,
      );
      expect(result.studentCode).toMatch(/^CWS/);
    });

    it('refuses a step its branch has switched off, and allows it again when switched back', async () => {
      const applicant = await draft('C');
      await act(applicant.id, 'C', WorkflowAction.SUBMIT);
      await act(applicant.id, 'C', WorkflowAction.START_REVIEW);

      // `applicant` was submitted before the switch, so it keeps the policy it
      // entered under; `late` is submitted after, so the switch binds it.
      await setBranch('C', ADMISSION_CONFIG_KEYS.waitlistEnabled, false);
      const late = await draft('C');
      await act(late.id, 'C', WorkflowAction.SUBMIT);
      await act(late.id, 'C', WorkflowAction.START_REVIEW);

      await expect(
        act(late.id, 'C', WorkflowAction.WAITLIST, ADMIN, 'full'),
      ).rejects.toMatchObject({ response: { error: 'POLICY_DISABLED' } });

      // The earlier application keeps the policy it entered under.
      await expect(
        act(applicant.id, 'C', WorkflowAction.WAITLIST, ADMIN, 'full'),
      ).resolves.toMatchObject({ admissionStatus: 'WAITLISTED' });

      await clearBranch('C', ADMISSION_CONFIG_KEYS.waitlistEnabled);
    });

    it('an application in flight keeps its process when the profile changes', async () => {
      const inFlight = await draft('C');
      await act(inFlight.id, 'C', WorkflowAction.SUBMIT);

      await setBranch(
        'C',
        ADMISSION_CONFIG_KEYS.workflowProfile,
        'SIMPLE_ADMISSION',
      );
      try {
        await expect(directAdmit(inFlight.id, 'C')).rejects.toMatchObject({
          response: { error: 'WORKFLOW_PROFILE_MISMATCH' },
        });

        const fresh = await draft('C');
        await expect(directAdmit(fresh.id, 'C')).resolves.toMatchObject({
          walked: ['submit', 'startReview', 'approve', 'confirmSeat'],
        });
      } finally {
        await clearBranch('C', ADMISSION_CONFIG_KEYS.workflowProfile);
      }
    });

    it('keeps an issued offer deadline when the window is changed later', async () => {
      const applicant = await draft('C');
      await act(applicant.id, 'C', WorkflowAction.SUBMIT);
      await act(applicant.id, 'C', WorkflowAction.START_REVIEW);
      await act(applicant.id, 'C', WorkflowAction.APPROVE);
      const issued = await prisma.applicant.findUniqueOrThrow({
        where: { id: applicant.id },
      });

      await setBranch('C', ADMISSION_CONFIG_KEYS.offerValidityDays, 3);
      const after = await prisma.applicant.findUniqueOrThrow({
        where: { id: applicant.id },
      });
      expect(after.offerExpiresAt!.getTime()).toBe(
        issued.offerExpiresAt!.getTime(),
      );
      expect(
        issued.offerExpiresAt!.getTime() - issued.offerIssuedAt!.getTime(),
      ).toBe(15 * 24 * 60 * 60 * 1000);
      await clearBranch('C', ADMISSION_CONFIG_KEYS.offerValidityDays);
    });
  });

  // ---------------------------------------------------------------------------
  // VERIFIED_ADMISSION
  // ---------------------------------------------------------------------------

  describe('VERIFIED_ADMISSION', () => {
    it('refuses an approval by the user who started the review', async () => {
      const applicant = await draft('B');
      await act(applicant.id, 'B', WorkflowAction.SUBMIT);
      await act(applicant.id, 'B', WorkflowAction.START_REVIEW, REVIEWER);

      await expect(
        act(applicant.id, 'B', WorkflowAction.APPROVE, REVIEWER),
      ).rejects.toMatchObject({
        response: { error: 'MAKER_CHECKER_VIOLATION' },
      });

      await expect(
        act(applicant.id, 'B', WorkflowAction.APPROVE, ADMIN),
      ).resolves.toMatchObject({ admissionStatus: 'APPROVED' });
    });

    it('blocks review until review-stage documents are verified', async () => {
      await requireDocument('UNDER_REVIEW', branch.B);
      const applicant = await draft('B');
      await act(applicant.id, 'B', WorkflowAction.SUBMIT);

      await expect(
        act(applicant.id, 'B', WorkflowAction.START_REVIEW),
      ).rejects.toMatchObject({ response: { error: 'DOCUMENTS_INCOMPLETE' } });

      const actions = await workflow.describeActions(
        applicant.id,
        scope('B'),
        ADMIN,
      );
      const start = actions.actions.find((a) => a.action === 'startReview')!;
      expect(start.available).toBe(false);
      expect(start.blockedBy[0]).toMatchObject({
        code: 'DOCUMENTS_INCOMPLETE',
      });
    });

    it('refuses direct admission', async () => {
      const applicant = await draft('B');
      await expect(directAdmit(applicant.id, 'B')).rejects.toMatchObject({
        response: { error: 'WORKFLOW_PROFILE_MISMATCH' },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // D1 — requirement scope
  // ---------------------------------------------------------------------------

  describe('document requirements are scoped to their branch and organization', () => {
    it("a branch's requirement does not block another branch", async () => {
      await requireDocument('UNDER_REVIEW', branch.B);
      const applicant = await draft('C');
      await act(applicant.id, 'C', WorkflowAction.SUBMIT);
      await act(applicant.id, 'C', WorkflowAction.START_REVIEW);

      await expect(
        act(applicant.id, 'C', WorkflowAction.APPROVE),
      ).resolves.toMatchObject({ admissionStatus: 'APPROVED' });

      const checklist = await workflow.describeChecklist(
        applicant.id,
        scope('C'),
      );
      expect(checklist.items).toHaveLength(0);
    });

    it('an organization-wide requirement binds every branch', async () => {
      await requireDocument('UNDER_REVIEW', null);
      const applicant = await draft('C');
      await act(applicant.id, 'C', WorkflowAction.SUBMIT);
      await act(applicant.id, 'C', WorkflowAction.START_REVIEW);

      await expect(
        act(applicant.id, 'C', WorkflowAction.APPROVE),
      ).rejects.toMatchObject({
        response: { error: 'DOCUMENTS_INCOMPLETE' },
      });
      const checklist = await workflow.describeChecklist(
        applicant.id,
        scope('C'),
      );
      expect(checklist.items).toEqual([
        expect.objectContaining({
          status: 'MISSING',
          branchId: null,
          requiredByStage: 'UNDER_REVIEW',
        }),
      ]);
      expect(checklist.outstandingMandatory).toBe(1);
    });

    it('another organization’s requirement never applies', async () => {
      await requireDocument(
        'UNDER_REVIEW',
        null,
        otherOrgId,
        otherOrgDocumentTypeId,
      );
      const applicant = await draft('C');
      await act(applicant.id, 'C', WorkflowAction.SUBMIT);
      await act(applicant.id, 'C', WorkflowAction.START_REVIEW);

      await expect(
        act(applicant.id, 'C', WorkflowAction.APPROVE),
      ).resolves.toMatchObject({ admissionStatus: 'APPROVED' });
    });
  });
});
