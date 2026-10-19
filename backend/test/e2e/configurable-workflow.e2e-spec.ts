import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PasswordService } from '@/common/services/password.service';
import { UserRole } from '@/common/enums/role.enum';
import { ApplicantService } from '@/modules/admissions/applicant/applicant.service';
import { NumberingService } from '@/infrastructure/numbering/numbering.service';
import { contextHeaders, ContextHeaders } from '../helpers/context.helper';

/**
 * Configurable admission workflows over HTTP.
 *
 * The behaviour is proved in the integration suite; this checks the boundary:
 * who may read and change policy, that a client can name a scope *type* but
 * never a scope id, that the read contracts answer in the envelope, and that
 * direct admission is reachable only with the right profile, role and tenant.
 */
describe('Configurable admission workflows (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let applicants: ApplicantService;

  const stamp = Date.now().toString();
  let seq = 0;

  let adminToken: string;
  let orgAdminToken: string;
  let branchAdminToken: string;
  let staffToken: string;

  let orgId: string;
  let otherOrgId: string;
  let branchId: string;
  let otherBranchId: string;
  let yearId: string;
  let otherYearId: string;
  let programId: string;
  let unitId: string;
  let genderId: string;
  let documentTypeId: string;

  let ctx: ContextHeaders;
  let otherCtx: ContextHeaders;

  const PROFILE = 'admissions.workflow_profile';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    prisma = app.get(PrismaService);
    applicants = app.get(ApplicantService);
    const passwords = app.get(PasswordService);
    const numbering = app.get(NumberingService);
    await app.init();

    const makeOrg = async (label: string) =>
      (
        await prisma.organization.create({
          data: {
            name: `CWE ${label}`,
            code: `cwe-${label}-${stamp}`,
            contactEmail: `cwe-${label}@test.local`,
            contactPhone: '1234567890',
            masterExpiryDate: new Date(Date.now() + 10000000000),
          },
        })
      ).id;
    const makeBranch = async (organizationId: string, label: string) =>
      (
        await prisma.branch.create({
          data: {
            organizationId,
            name: `CWE Branch ${label}`,
            code: `cwe-br-${label}-${stamp}`,
            institutionType: 'SCHOOL',
            contactEmail: 'br@test.local',
            contactPhone: '1234567890',
            addressLine1: 'Street 1',
            city: 'City',
            state: 'State',
            country: 'IN',
            pincode: '123456',
          },
        })
      ).id;
    const makeYear = async (branch: string) =>
      (
        await prisma.academicYear.create({
          data: {
            branchId: branch,
            name: `2026-27 ${stamp}`,
            startDate: new Date('2026-04-01'),
            endDate: new Date('2027-03-31'),
            isActive: true,
            isSelected: true,
          },
        })
      ).id;

    orgId = await makeOrg('org');
    otherOrgId = await makeOrg('other');
    branchId = await makeBranch(orgId, 'a');
    otherBranchId = await makeBranch(otherOrgId, 'b');
    yearId = await makeYear(branchId);
    otherYearId = await makeYear(otherBranchId);

    programId = (
      await prisma.program.create({
        data: { branchId, name: `Std 1 ${stamp}` },
      })
    ).id;
    unitId = (
      await prisma.academicUnit.create({
        data: {
          branchId,
          programId,
          academicYearId: yearId,
          name: 'Std 1-A',
          unitType: 'SECTION',
          level: 1,
        },
      })
    ).id;
    genderId = (
      await prisma.gender.create({
        data: {
          organizationId: orgId,
          code: `CWEG_${stamp}`,
          name: `G ${stamp}`,
        },
      })
    ).id;
    documentTypeId = (
      await prisma.documentType.create({
        data: {
          organizationId: orgId,
          code: `CWE_TC_${stamp}`,
          name: 'Transfer certificate',
          allowedMimeTypes: ['application/pdf'],
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
          prefix: purpose === 'ADMISSION_NO' ? 'AD' : 'APP',
          sequencePadding: 5,
          format: '{prefix}-{year}-{sequence}',
        },
        orgId,
        branchId,
      );
    }
    await numbering.createConfig(
      {
        purpose: 'STUDENT_CODE',
        prefix: 'STU',
        sequencePadding: 10,
        format: '{prefix}{sequence}',
      },
      orgId,
      null,
    );

    const password = 'Password123!';
    const hash = await passwords.hash(password);
    const login = async (
      role: UserRole,
      label: string,
      scope: { organizationId?: string; branchId?: string } = {},
    ) => {
      const user = await prisma.user.create({
        data: {
          fullName: `CWE ${label}`,
          username: `cwe-${label}-${stamp}`,
          email: `cwe-${label}-${stamp}@test.local`,
          phone: `8${(seq += 1)}${stamp}`.slice(0, 12),
          passwordHash: hash,
          role,
          ...scope,
        },
      });
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ identifier: user.email, password });
      return response.body.data.accessToken as string;
    };

    adminToken = await login(UserRole.SUPER_ADMIN, 'admin');
    orgAdminToken = await login(UserRole.ORG_ADMIN, 'orgadmin', {
      organizationId: orgId,
    });
    branchAdminToken = await login(UserRole.BRANCH_ADMIN, 'branchadmin', {
      organizationId: orgId,
      branchId,
    });
    staffToken = await login(UserRole.STAFF, 'staff', {
      organizationId: orgId,
      branchId,
    });

    ctx = contextHeaders(orgId, branchId, yearId);
    otherCtx = contextHeaders(otherOrgId, otherBranchId, otherYearId);
  });

  afterAll(async () => {
    await prisma.configValue.deleteMany({
      where: { scopeId: { in: [orgId, otherOrgId, branchId, otherBranchId] } },
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
          exitDate: new Date(),
          exitReason: 'CANCELLED_BEFORE_JOINING',
        },
      });
      await prisma.enrollment.deleteMany({ where: { organizationId: org } });
      await prisma.admission.updateMany({
        where: { organizationId: org },
        data: { sourceApplicantId: null },
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
      // Users reference the organization and branch; detach before removing.
      await prisma.user.updateMany({
        where: { organizationId: org },
        data: { organizationId: null, branchId: null },
      });
      await prisma.branch.deleteMany({ where: { organizationId: org } });
      await prisma.organization.deleteMany({ where: { id: org } });
    }
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  /** The error code, whether or not the global exception filter shaped the body. */
  const codeOf = (body: { error?: string | { code?: string } }) =>
    typeof body.error === 'object' ? body.error?.code : body.error;
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function draft() {
    seq += 1;
    const { applicant } = await applicants.create(
      {
        firstName: 'Aarav',
        lastName: `CWE${stamp}${seq}`,
        dob: '2016-04-12',
        genderId,
        programId,
        primaryMobile: `96${String(seq).padStart(8, '0')}`,
        currentAddressLine1: 'Road 1',
        city: 'City',
        state: 'State',
        country: 'IN',
        pincode: '123456',
      } as never,
      { organizationId: orgId, branchId, academicYearId: yearId },
    );
    return applicant;
  }

  // ---------------------------------------------------------------------------

  describe('GET /admissions/workflow/policy', () => {
    it('answers the STANDARD default in the envelope', async () => {
      const response = await http()
        .get('/admissions/workflow/policy')
        .set(as(staffToken))
        .set(ctx)
        .expect(200);

      expect(response.body.data).toMatchObject({
        workflowProfile: 'STANDARD_ADMISSION',
        offerValidityDays: 15,
        allowDeferment: false,
        sources: { workflowProfile: 'DEFAULT' },
      });
    });
  });

  describe('PUT /config/values/:key', () => {
    it('is closed to staff', async () => {
      await http()
        .put(`/config/values/${PROFILE}`)
        .set(as(staffToken))
        .set(ctx)
        .send({ scopeType: 'BRANCH', value: 'SIMPLE_ADMISSION', reason: 'x' })
        .expect(403);
    });

    it('is closed to a branch administrator without the policy permission', async () => {
      await http()
        .put(`/config/values/${PROFILE}`)
        .set(as(branchAdminToken))
        .set(ctx)
        .send({ scopeType: 'BRANCH', value: 'SIMPLE_ADMISSION', reason: 'x' })
        .expect(403);
    });

    it('refuses a scope id in the body — the scope is the request’s own', async () => {
      await http()
        .put(`/config/values/${PROFILE}`)
        .set(as(orgAdminToken))
        .set(ctx)
        .send({
          scopeType: 'BRANCH',
          scopeId: otherBranchId,
          value: 'SIMPLE_ADMISSION',
          reason: 'x',
        })
        .expect(400);
    });

    it('validates the value and requires a reason', async () => {
      const bad = await http()
        .put(`/config/values/${PROFILE}`)
        .set(as(orgAdminToken))
        .set(ctx)
        .send({ scopeType: 'BRANCH', value: 'ANYTHING', reason: 'x' })
        .expect(400);
      expect(codeOf(bad.body)).toBe('CONFIG_VALUE_INVALID');

      const noReason = await http()
        .put(`/config/values/${PROFILE}`)
        .set(as(orgAdminToken))
        .set(ctx)
        .send({ scopeType: 'BRANCH', value: 'SIMPLE_ADMISSION' })
        .expect(400);
      expect(codeOf(noReason.body)).toBe('CONFIG_REASON_REQUIRED');
    });

    it('refuses an unknown key', async () => {
      const response = await http()
        .put('/config/values/admissions.not_a_key')
        .set(as(orgAdminToken))
        .set(ctx)
        .send({ scopeType: 'BRANCH', value: true, reason: 'x' })
        .expect(404);
      expect(codeOf(response.body)).toBe('CONFIG_KEY_NOT_FOUND');
    });

    it('lets an organization administrator set the branch profile, with history', async () => {
      await http()
        .put(`/config/values/${PROFILE}`)
        .set(as(orgAdminToken))
        .set(ctx)
        .send({
          scopeType: 'BRANCH',
          value: 'SIMPLE_ADMISSION',
          reason: 'walk-in school',
        })
        .expect(200);

      const policy = await http()
        .get('/admissions/workflow/policy')
        .set(as(staffToken))
        .set(ctx)
        .expect(200);
      expect(policy.body.data).toMatchObject({
        workflowProfile: 'SIMPLE_ADMISSION',
        sources: { workflowProfile: 'BRANCH' },
      });

      const history = await http()
        .get(`/config/values/${PROFILE}`)
        .query({ scopeType: 'BRANCH' })
        .set(as(orgAdminToken))
        .set(ctx)
        .expect(200);
      expect(history.body.data[0]).toMatchObject({
        value: 'SIMPLE_ADMISSION',
        scopeId: branchId,
        reason: 'walk-in school',
        effectiveTo: null,
      });
    });
  });

  describe('applicant read contracts', () => {
    it('reports actions and one-step availability for the caller', async () => {
      const applicant = await draft();

      const admin = await http()
        .get(`/admissions/applicants/${applicant.id}/workflow/actions`)
        .set(as(adminToken))
        .set(ctx)
        .expect(200);
      expect(admin.body.data.profile).toBe('SIMPLE_ADMISSION');
      expect(admin.body.data.directAdmission.available).toBe(true);
      const draftActions = admin.body.data.actions.map(
        (a: { action: string }) => a.action,
      );
      // A draft is closed by deleting it, never by withdraw or cancel.
      expect(draftActions).toContain('submit');
      expect(draftActions).not.toContain('withdraw');
      expect(draftActions).not.toContain('cancel');
      expect(admin.body.data.deleteDraft).toEqual({
        permitted: true,
        available: true,
      });

      const staff = await http()
        .get(`/admissions/applicants/${applicant.id}/workflow/actions`)
        .set(as(staffToken))
        .set(ctx)
        .expect(200);
      expect(staff.body.data.directAdmission.permitted).toBe(false);
      expect(staff.body.data.deleteDraft).toEqual({
        permitted: false,
        available: false,
      });

      await http()
        .post(`/admissions/applicants/${applicant.id}/workflow/transition`)
        .set(as(adminToken))
        .set(ctx)
        .send({ action: 'submit' })
        .expect(201);

      const submitted = await http()
        .get(`/admissions/applicants/${applicant.id}/workflow/actions`)
        .set(as(staffToken))
        .set(ctx)
        .expect(200);
      const cancel = submitted.body.data.actions.find(
        (a: { action: string }) => a.action === 'cancel',
      );
      expect(cancel).toMatchObject({ permitted: false, available: false });
      expect(submitted.body.data.deleteDraft.available).toBe(false);
    });

    it('reports the checklist the guards use', async () => {
      const applicant = await draft();
      const response = await http()
        .get(`/admissions/applicants/${applicant.id}/checklist`)
        .set(as(staffToken))
        .set(ctx)
        .expect(200);
      expect(response.body.data).toMatchObject({
        applicantId: applicant.id,
        items: [],
        outstandingMandatory: 0,
      });
    });

    it('does not answer for another tenant’s applicant', async () => {
      const applicant = await draft();
      await http()
        .get(`/admissions/applicants/${applicant.id}/workflow/actions`)
        .set(as(adminToken))
        .set(otherCtx)
        .expect(404);
    });
  });

  describe('closing a draft', () => {
    const transition = (id: string, action: string, token = adminToken) =>
      http()
        .post(`/admissions/applicants/${id}/workflow/transition`)
        .set(as(token))
        .set(ctx)
        .send({ action, remarks: 'applicant changed their mind' });

    it('refuses to withdraw or cancel a draft with a 400, not a database error', async () => {
      const applicant = await draft();

      for (const action of ['withdraw', 'cancel']) {
        const response = await transition(applicant.id, action).expect(400);
        expect(codeOf(response.body)).toBe('INVALID_TRANSITION');
        expect(response.body.message).toBe(
          `Cannot ${action} an application in state DRAFT.`,
        );
      }

      const row = await prisma.applicant.findUniqueOrThrow({
        where: { id: applicant.id },
      });
      expect(row.admissionStatus).toBe('DRAFT');
      expect(
        await prisma.workflowHistory.count({
          where: { entityId: applicant.id },
        }),
      ).toBe(0);
    });

    it('deletes a draft softly, and only once', async () => {
      const applicant = await draft();

      await http()
        .delete(`/admissions/applicants/${applicant.id}`)
        .set(as(adminToken))
        .set(ctx)
        .expect(200);

      const row = await prisma.applicant.findUniqueOrThrow({
        where: { id: applicant.id },
      });
      expect(row.deletedAt).not.toBeNull();
      expect(row.admissionStatus).toBe('DRAFT');
      expect(
        await prisma.outboxEvent.count({
          where: { aggregateId: applicant.id, eventName: 'applicant.deleted' },
        }),
      ).toBe(1);

      await http()
        .delete(`/admissions/applicants/${applicant.id}`)
        .set(as(adminToken))
        .set(ctx)
        .expect(404);
    });

    it('refuses to delete a submitted application, and leaves it untouched', async () => {
      const applicant = await draft();
      await transition(applicant.id, 'submit').expect(201);

      const response = await http()
        .delete(`/admissions/applicants/${applicant.id}`)
        .set(as(adminToken))
        .set(ctx)
        .expect(403);
      expect(codeOf(response.body)).toBe('APPLICANT_NOT_DELETABLE');

      const row = await prisma.applicant.findUniqueOrThrow({
        where: { id: applicant.id },
      });
      expect(row.deletedAt).toBeNull();
      expect(row.admissionStatus).toBe('SUBMITTED');

      // The submitted application is still closed the normal way.
      const withdrawn = await transition(applicant.id, 'withdraw').expect(201);
      expect(withdrawn.body.data.admissionStatus).toBe('WITHDRAWN');
    });

    it('refuses staff, and another tenant cannot see the draft at all', async () => {
      const applicant = await draft();

      await http()
        .delete(`/admissions/applicants/${applicant.id}`)
        .set(as(staffToken))
        .set(ctx)
        .expect(403);
      await http()
        .delete(`/admissions/applicants/${applicant.id}`)
        .set(as(adminToken))
        .set(otherCtx)
        .expect(404);

      const row = await prisma.applicant.findUniqueOrThrow({
        where: { id: applicant.id },
      });
      expect(row.deletedAt).toBeNull();
    });
  });

  describe('POST /admissions/applicants/:id/direct-admit', () => {
    it('admits a draft in one call under SIMPLE_ADMISSION', async () => {
      const applicant = await draft();
      const response = await http()
        .post(`/admissions/applicants/${applicant.id}/direct-admit`)
        .set(as(adminToken))
        .set(ctx)
        .send({ academicUnitId: unitId, remarks: 'walk-in' })
        .expect(201);

      expect(response.body.data).toMatchObject({
        applicantId: applicant.id,
        studentCode: expect.stringMatching(/^STU\d{10}$/),
        admissionNo: expect.stringMatching(/^AD-/),
        walked: ['submit', 'startReview', 'approve', 'confirmSeat'],
      });
    });

    it('is closed to staff', async () => {
      const applicant = await draft();
      await http()
        .post(`/admissions/applicants/${applicant.id}/direct-admit`)
        .set(as(staffToken))
        .set(ctx)
        .send({ academicUnitId: unitId })
        .expect(403);
    });

    it('cannot be reached across tenants', async () => {
      const applicant = await draft();
      await http()
        .post(`/admissions/applicants/${applicant.id}/direct-admit`)
        .set(as(adminToken))
        .set(otherCtx)
        .send({ academicUnitId: unitId })
        .expect(404);
    });

    it('is refused once the branch returns to the standard process', async () => {
      await http()
        .delete(`/config/values/${PROFILE}`)
        .set(as(orgAdminToken))
        .set(ctx)
        .send({ scopeType: 'BRANCH', reason: 'back to standard' })
        .expect(200);

      const applicant = await draft();
      const response = await http()
        .post(`/admissions/applicants/${applicant.id}/direct-admit`)
        .set(as(adminToken))
        .set(ctx)
        .send({ academicUnitId: unitId })
        .expect(400);
      expect(codeOf(response.body)).toBe('WORKFLOW_PROFILE_MISMATCH');
    });
  });

  describe('POST /document-requirements', () => {
    it('refuses a stage no workflow step checks', async () => {
      const response = await http()
        .post('/document-requirements')
        .set(as(adminToken))
        .set(contextHeaders(orgId, branchId))
        .send({ documentTypeId, requiredByStage: 'CANCELLED' })
        .expect(400);
      expect(codeOf(response.body)).toBe('UNSUPPORTED_REQUIREMENT_STAGE');
    });
  });
});
