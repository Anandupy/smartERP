import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PasswordService } from '@/common/services/password.service';
import { UserRole } from '@/common/enums/role.enum';
import { WorkflowService } from '@/modules/admissions/workflow/workflow.service';
import { WorkflowAction } from '@/modules/admissions/workflow/workflow.transitions';
import { ApplicantService } from '@/modules/admissions/applicant/applicant.service';
import { NumberingService } from '@/infrastructure/numbering/numbering.service';
import { contextHeaders, ContextHeaders } from '../helpers/context.helper';

/**
 * The admission command over HTTP.
 *
 * The service is proved in the integration suite; what this checks is the
 * boundary — that the route is reachable only with the right scope and the
 * right role, that a client cannot supply a server-owned value, and that the
 * response says what it should and nothing more.
 */
describe('Admission conversion (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let applicants: ApplicantService;
  let workflow: WorkflowService;

  const stamp = Date.now().toString();
  let seq = 0;

  let adminToken: string;
  let staffToken: string;

  let orgId: string;
  let otherOrgId: string;
  let branchId: string;
  let otherBranchId: string;
  let yearId: string;
  let otherYearId: string;
  let programId: string;
  let unitId: string;
  let otherUnitId: string;
  let genderId: string;

  let ctx: ContextHeaders;
  let otherCtx: ContextHeaders;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    prisma = app.get(PrismaService);
    applicants = app.get(ApplicantService);
    workflow = app.get(WorkflowService);
    const passwords = app.get(PasswordService);
    const numbering = app.get(NumberingService);
    await app.init();

    const makeOrg = async (label: string) =>
      (
        await prisma.organization.create({
          data: {
            name: `Admit ${label}`,
            code: `admit-${label}-${stamp}`,
            contactEmail: `admit-${label}@test.local`,
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
            name: `Admit Branch ${label}`,
            code: `admit-br-${label}-${stamp}`,
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

    orgId = await makeOrg('org');
    otherOrgId = await makeOrg('other');
    branchId = await makeBranch(orgId, 'a');
    otherBranchId = await makeBranch(otherOrgId, 'b');

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

    yearId = await makeYear(branchId);
    otherYearId = await makeYear(otherBranchId);

    programId = (
      await prisma.program.create({
        data: { branchId, name: `Std 1 ${stamp}` },
      })
    ).id;
    const otherProgramId = (
      await prisma.program.create({
        data: { branchId: otherBranchId, name: `Std 1 other ${stamp}` },
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
    otherUnitId = (
      await prisma.academicUnit.create({
        data: {
          branchId: otherBranchId,
          programId: otherProgramId,
          academicYearId: otherYearId,
          name: 'Std 1-Z',
          unitType: 'SECTION',
          level: 1,
        },
      })
    ).id;

    genderId = (
      await prisma.gender.create({
        data: { organizationId: orgId, code: `AG_${stamp}`, name: `G ${stamp}` },
      })
    ).id;

    for (const purpose of ['ADMISSION_FORM', 'APPLICATION', 'ADMISSION_NO'] as const) {
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

    const login = async (role: UserRole, label: string) => {
      const user = await prisma.user.create({
        data: {
          fullName: `Admit ${label}`,
          username: `admit-${label}-${stamp}`,
          email: `admit-${label}-${stamp}@test.local`,
          phone: `9${(seq += 1)}${stamp}`.slice(0, 12),
          passwordHash: hash,
          role,
        },
      });
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ identifier: user.email, password });
      return response.body.data.accessToken as string;
    };

    adminToken = await login(UserRole.SUPER_ADMIN, 'admin');
    staffToken = await login(UserRole.STAFF, 'staff');

    ctx = contextHeaders(orgId, branchId, yearId);
    otherCtx = contextHeaders(otherOrgId, otherBranchId, otherYearId);
  });

  afterAll(async () => {
    for (const org of [orgId, otherOrgId]) {
      await prisma.auditLog.deleteMany({ where: { organizationId: org } });
      await prisma.outboxEvent.deleteMany({ where: { organizationId: org } });
      await prisma.workflowHistory.deleteMany({ where: { organizationId: org } });
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
      await prisma.organizationDataKey.deleteMany({ where: { organizationId: org } });
      await prisma.numberSequenceCounter.deleteMany({
        where: { config: { organizationId: org } },
      });
      await prisma.numberSequenceConfig.deleteMany({ where: { organizationId: org } });
      await prisma.academicUnit.deleteMany({
        where: { branch: { organizationId: org } },
      });
      await prisma.program.deleteMany({ where: { branch: { organizationId: org } } });
      await prisma.academicYear.deleteMany({
        where: { branch: { organizationId: org } },
      });
      await prisma.gender.deleteMany({ where: { organizationId: org } });
      await prisma.branch.deleteMany({ where: { organizationId: org } });
      await prisma.organization.deleteMany({ where: { id: org } });
    }
    // The users stay: sessions, audit rows and permission overrides reference
    // them, and every other e2e spec leaves its own behind for the same reason.
    await app.close();
  });

  /** An applicant driven to SEAT_CONFIRMED through the service layer. */
  async function seatConfirmed() {
    seq += 1;
    const scope = { organizationId: orgId, branchId, academicYearId: yearId };
    const { applicant } = await applicants.create(
      {
        firstName: 'Riya',
        lastName: `E2E${stamp}${seq}`,
        dob: '2015-04-12',
        genderId,
        programId,
        primaryMobile: `95${String(seq).padStart(8, '0')}`,
        currentAddressLine1: 'Road 1',
        city: 'City',
        state: 'State',
        country: 'IN',
        pincode: '123456',
      } as never,
      scope,
    );

    const actor = { userId: '00000000-0000-4000-8000-00000000e2e1', role: 'SUPER_ADMIN' };
    for (const action of [
      WorkflowAction.SUBMIT,
      WorkflowAction.START_REVIEW,
      WorkflowAction.APPROVE,
      WorkflowAction.CONFIRM_SEAT,
    ]) {
      await workflow.transition(applicant.id, { action }, scope, actor);
    }

    return applicant;
  }

  const admit = (applicantId: string, token: string, headers: ContextHeaders) =>
    request(app.getHttpServer())
      .post(`/admissions/applicants/${applicantId}/admit`)
      .set('Authorization', `Bearer ${token}`)
      .set(headers);

  // ---------------------------------------------------------------------------

  it('admits an applicant and returns the four identifiers', async () => {
    const applicant = await seatConfirmed();

    const response = await admit(applicant.id, adminToken, ctx)
      .send({ academicUnitId: unitId, remarks: 'seat accepted' })
      .expect(201);

    expect(response.body.data).toEqual({
      studentId: expect.any(String),
      studentCode: expect.stringMatching(/^STU\d{10}$/),
      admissionId: expect.any(String),
      admissionNo: expect.stringMatching(/^AD-.+-\d{5}$/),
      enrollmentId: expect.any(String),
      applicantId: applicant.id,
    });

    // Identifiers and a printable code. Nothing about the person, and nothing
    // from the identity layer.
    const body = JSON.stringify(response.body);
    expect(body).not.toMatch(/aadhaar|personId|govtIdHash|dob/i);
  });

  it('refuses a second admission of the same applicant', async () => {
    const applicant = await seatConfirmed();

    const first = await admit(applicant.id, adminToken, ctx)
      .send({ academicUnitId: unitId })
      .expect(201);

    const second = await admit(applicant.id, adminToken, ctx)
      .send({ academicUnitId: unitId })
      .expect(409);

    expect(second.body.error?.code ?? second.body.error).toBeDefined();
    // The conflict names the student that already exists, so a client can
    // treat a retry as the completed operation it is.
    expect(JSON.stringify(second.body)).toContain(first.body.data.studentCode);
  });

  it('refuses an applicant that has not confirmed a seat', async () => {
    seq += 1;
    const scope = { organizationId: orgId, branchId, academicYearId: yearId };
    const { applicant } = await applicants.create(
      {
        firstName: 'Riya',
        lastName: `Early${stamp}${seq}`,
        dob: '2015-04-12',
        genderId,
        programId,
        primaryMobile: `94${String(seq).padStart(8, '0')}`,
        currentAddressLine1: 'Road 1',
        city: 'City',
        state: 'State',
        country: 'IN',
        pincode: '123456',
      } as never,
      scope,
    );

    await admit(applicant.id, adminToken, ctx)
      .send({ academicUnitId: unitId })
      .expect(409);

    expect(
      await prisma.student.count({ where: { sourceApplicantId: applicant.id } }),
    ).toBe(0);
  });

  it('answers 404 for an applicant in another organization', async () => {
    const applicant = await seatConfirmed();

    // The id is valid and the caller is a SUPER_ADMIN — of a different tenant.
    // A 403 here would confirm the applicant exists.
    await admit(applicant.id, adminToken, otherCtx)
      .send({ academicUnitId: otherUnitId })
      .expect(404);

    expect(
      await prisma.student.count({ where: { sourceApplicantId: applicant.id } }),
    ).toBe(0);
  });

  it('refuses a role that cannot admit', async () => {
    const applicant = await seatConfirmed();

    await admit(applicant.id, staffToken, ctx)
      .send({ academicUnitId: unitId })
      .expect(403);

    expect(
      await prisma.student.count({ where: { sourceApplicantId: applicant.id } }),
    ).toBe(0);
  });

  it('requires authentication', async () => {
    const applicant = await seatConfirmed();

    await request(app.getHttpServer())
      .post(`/admissions/applicants/${applicant.id}/admit`)
      .set(ctx)
      .send({ academicUnitId: unitId })
      .expect(401);
  });

  it('rejects a body carrying a server-owned value', async () => {
    const applicant = await seatConfirmed();

    // `forbidNonWhitelisted` is what makes mass assignment impossible: there is
    // no DTO field to receive these, so the request never reaches the service.
    for (const injected of [
      { studentCode: 'STU9999999999' },
      { organizationId: otherOrgId },
      { branchId: otherBranchId },
      { programId },
      { orchestrated: true },
    ]) {
      await admit(applicant.id, adminToken, ctx)
        .send({ academicUnitId: unitId, ...injected })
        .expect(400);
    }

    expect(
      await prisma.student.count({ where: { sourceApplicantId: applicant.id } }),
    ).toBe(0);
  });

  it('rejects a missing or malformed academic unit', async () => {
    const applicant = await seatConfirmed();

    await admit(applicant.id, adminToken, ctx).send({}).expect(400);
    await admit(applicant.id, adminToken, ctx)
      .send({ academicUnitId: 'not-a-uuid' })
      .expect(400);
  });

  it('refuses an academic unit from another branch', async () => {
    const applicant = await seatConfirmed();

    await admit(applicant.id, adminToken, ctx)
      .send({ academicUnitId: otherUnitId })
      .expect(400);

    expect(
      await prisma.student.count({ where: { sourceApplicantId: applicant.id } }),
    ).toBe(0);
  });

  it('cannot reach ADMITTED through the generic workflow endpoint', async () => {
    const applicant = await seatConfirmed();

    const response = await request(app.getHttpServer())
      .post(`/admissions/applicants/${applicant.id}/workflow/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(ctx)
      .send({ action: 'admit' })
      .expect(400);

    expect(JSON.stringify(response.body)).toContain('ORCHESTRATED_TRANSITION');

    const after = await prisma.applicant.findUniqueOrThrow({
      where: { id: applicant.id },
    });
    expect(after.admissionStatus).toBe('SEAT_CONFIRMED');
    expect(
      await prisma.student.count({ where: { sourceApplicantId: applicant.id } }),
    ).toBe(0);
  });
});
