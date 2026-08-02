import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { UserRole } from '@/common/enums/role.enum';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PasswordService } from '@/common/services/password.service';
import { GlobalResponseInterceptor } from '@/interceptors/global-response.interceptor';

describe('Academic Year Context Pipeline (e2e)', () => {
  jest.setTimeout(30000);
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordService: PasswordService;
  let accessToken: string;
  let branchId1: string;
  let branchId2: string;
  let academicYearId1: string;
  let academicYearId2: string;
  let organizationId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    app.useGlobalInterceptors(new GlobalResponseInterceptor());
    prisma = app.get(PrismaService);
    passwordService = app.get(PasswordService);
    await app.init();

    // Create admin user for testing
    const password = 'Password123!';
    const hash = await passwordService.hash(password);
    const user = await prisma.user.create({
      data: {
        fullName: 'AY Guard Admin',
        username: 'ayadmin-' + Date.now(),
        email: 'ayadmin-' + Date.now() + '@test.com',
        phone: '999' + Math.floor(1000000 + Math.random() * 9000000),
        passwordHash: hash,
        role: UserRole.SUPER_ADMIN,
      },
    });

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: user.email, password });

    accessToken = loginResponse.body.data.accessToken;

    // Create Organization & 2 Branches
    const org = await prisma.organization.create({
      data: {
        name: 'AY Test Trust',
        code: 'AYORG-' + Date.now(),
        contactEmail: 'ayorg@test.com',
        contactPhone: '1234567890',
        masterExpiryDate: new Date(Date.now() + 10000000),
      },
    });

    const b1 = await prisma.branch.create({
      data: {
        organizationId: org.id,
        name: 'Branch Alpha',
        code: 'BALPHA-' + Date.now(),
        institutionType: 'SCHOOL',
        contactEmail: 'alpha@test.com',
        contactPhone: '1234567890',
        addressLine1: 'Address 1',
        city: 'City A',
        state: 'State A',
        country: 'Country A',
        pincode: '123456',
      },
    });
    branchId1 = b1.id;
    organizationId = org.id;

    const b2 = await prisma.branch.create({
      data: {
        organizationId: org.id,
        name: 'Branch Beta',
        code: 'BBETA-' + Date.now(),
        institutionType: 'SCHOOL',
        contactEmail: 'beta@test.com',
        contactPhone: '1234567890',
        addressLine1: 'Address 2',
        city: 'City B',
        state: 'State B',
        country: 'Country B',
        pincode: '123456',
      },
    });
    branchId2 = b2.id;

    // Create Academic Years for Branch 1 and Branch 2
    const ay1 = await prisma.academicYear.create({
      data: {
        branchId: branchId1,
        name: '2025-2026 Alpha',
        startDate: new Date('2025-04-01'),
        endDate: new Date('2026-03-31'),
        isActive: true,
        isSelected: true,
      },
    });
    academicYearId1 = ay1.id;

    const ay2 = await prisma.academicYear.create({
      data: {
        branchId: branchId2,
        name: '2025-2026 Beta',
        startDate: new Date('2025-04-01'),
        endDate: new Date('2026-03-31'),
        isActive: true,
        isSelected: true,
      },
    });
    academicYearId2 = ay2.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Academic year scope resolution & isolation', () => {
    // Resolution and validation live in ContextResolverService /
    // ContextValidatorService; AcademicYearGuard only asserts the outcome.
    // See docs/core/guard-pipeline.md.

    it('requires an explicit organization when several are visible', async () => {
      const res = await request(app.getHttpServer())
        .get('/admissions/applicants')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('CONTEXT_SELECTION_REQUIRED');
    });

    it('requires an explicit branch when the organization has several', async () => {
      const res = await request(app.getHttpServer())
        .get('/admissions/applicants')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-organization-id', organizationId);

      // This organization has two branches, so the branch cannot be inferred.
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('CONTEXT_SELECTION_REQUIRED');
    });

    it('rejects a branch id that does not resolve', async () => {
      const res = await request(app.getHttpServer())
        .get('/admissions/applicants')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-organization-id', organizationId)
        .set('x-branch-id', 'not-a-valid-uuid');

      expect(res.status).toBe(404);
    });

    it('rejects an academic year id that does not resolve', async () => {
      const res = await request(app.getHttpServer())
        .get('/admissions/applicants')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-organization-id', organizationId)
        .set('x-branch-id', branchId1)
        .set('x-academic-year-id', 'invalid-ay-uuid');

      expect(res.status).toBe(404);
    });

    it('rejects an academic year belonging to a different branch', async () => {
      const res = await request(app.getHttpServer())
        .get('/admissions/applicants')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-organization-id', organizationId)
        .set('x-branch-id', branchId1)
        .set('x-academic-year-id', academicYearId2); // Belongs to Branch Beta

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('does not belong to branch');
    });

    it('succeeds with a valid organization, branch and academic year', async () => {
      const res = await request(app.getHttpServer())
        .get('/admissions/applicants')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-organization-id', organizationId)
        .set('x-branch-id', branchId1)
        .set('x-academic-year-id', academicYearId1);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
