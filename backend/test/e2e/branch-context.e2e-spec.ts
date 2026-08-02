import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { UserRole } from '@/common/enums/role.enum';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PasswordService } from '@/common/services/password.service';
import { GlobalResponseInterceptor } from '@/interceptors/global-response.interceptor';

describe('Branch Context Pipeline (e2e)', () => {
  jest.setTimeout(30000);
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordService: PasswordService;
  let accessToken: string;
  let branchId: string;
  let organizationId: string;
  let otherOrganizationId: string;

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
        fullName: 'Branch Guard Admin',
        username: 'bradmin-' + Date.now(),
        email: 'bradmin-' + Date.now() + '@test.com',
        phone: '888' + Math.floor(1000000 + Math.random() * 9000000),
        passwordHash: hash,
        role: UserRole.SUPER_ADMIN,
      },
    });

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: user.email, password });

    accessToken = loginResponse.body.data.accessToken;

    // Create Organization & Branch
    const org = await prisma.organization.create({
      data: {
        name: 'Branch Guard Org',
        code: 'BRORG-' + Date.now(),
        contactEmail: 'brorg@test.com',
        contactPhone: '1234567890',
        masterExpiryDate: new Date(Date.now() + 10000000),
      },
    });

    const branch = await prisma.branch.create({
      data: {
        organizationId: org.id,
        name: 'Branch Guard Alpha',
        code: 'BRGA-' + Date.now(),
        institutionType: 'SCHOOL',
        contactEmail: 'brga@test.com',
        contactPhone: '1234567890',
        addressLine1: 'Address 1',
        city: 'City A',
        state: 'State A',
        country: 'Country A',
        pincode: '123456',
      },
    });
    branchId = branch.id;
    organizationId = org.id;

    // A second organization, so cross-tenant rejection can be exercised.
    const otherOrg = await prisma.organization.create({
      data: {
        name: 'Branch Guard Other Org',
        code: 'BRORG2-' + Date.now(),
        contactEmail: 'brorg2@test.com',
        contactPhone: '1234567891',
        masterExpiryDate: new Date(Date.now() + 10000000),
      },
    });
    otherOrganizationId = otherOrg.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Branch scope resolution', () => {
    // These exercise the pipeline described in docs/core/guard-pipeline.md.
    // Branch resolution and validation live in ContextResolverService /
    // ContextValidatorService; BranchGuard only asserts the outcome, so the
    // errors below come from resolution rather than from the guard.

    it('requires an explicit organization when several are visible', async () => {
      const res = await request(app.getHttpServer())
        .get('/programs')
        .set('Authorization', `Bearer ${accessToken}`);

      // A SUPER_ADMIN sees every organization, and other specs create their
      // own, so an unscoped request is ambiguous by design.
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('CONTEXT_SELECTION_REQUIRED');
    });

    it('auto-resolves the branch when the organization has exactly one', async () => {
      const res = await request(app.getHttpServer())
        .get('/programs')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-organization-id', organizationId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects a branch id that does not exist', async () => {
      const res = await request(app.getHttpServer())
        .get('/programs')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-organization-id', organizationId)
        .set('x-branch-id', '00000000-0000-7000-a000-000000000000');

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('not found');
    });

    it('rejects a malformed branch id', async () => {
      const res = await request(app.getHttpServer())
        .get('/programs')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-organization-id', organizationId)
        .set('x-branch-id', 'invalid-branch-uuid');

      expect(res.status).toBe(404);
    });

    it('rejects a branch belonging to another organization', async () => {
      const res = await request(app.getHttpServer())
        .get('/programs')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-organization-id', otherOrganizationId)
        .set('x-branch-id', branchId);

      // Cross-tenant access is rejected, never silently rewritten.
      expect([400, 403]).toContain(res.status);
    });

    it('succeeds with a valid organization and branch', async () => {
      const res = await request(app.getHttpServer())
        .get('/programs')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-organization-id', organizationId)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
