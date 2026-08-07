import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { UserRole } from '@/common/enums/role.enum';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PasswordService } from '@/common/services/password.service';
import { organizationHeaders } from '../helpers/context.helper';

/**
 * The bootstrap surface, called the way a real client calls it: with **no**
 * context headers at all.
 *
 * Every other e2e spec pins a tenant, because by the second spec the shared
 * database always holds several organizations and an unscoped request is
 * ambiguous. That is exactly the state this spec needs: a `SUPER_ADMIN` who can
 * see many organizations and has named none. It is the state a real deployment
 * reaches the moment a second organization exists, and it used to answer
 * `409 CONTEXT_SELECTION_REQUIRED` on *every* authenticated route — including
 * `GET /auth/me`, the endpoint that reports the organizations to choose from,
 * so the selection could never be made.
 *
 * The rule this spec pins down: a route that operates above or before a tenant
 * selection answers without one; every other route still demands it.
 */
describe('Execution context selection (e2e)', () => {
  jest.setTimeout(30000);
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdminToken: string;
  let orgAdminToken: string;
  let firstOrgId: string;
  let secondOrgId: string;
  /** A branch of the first organization. */
  let branchId: string;
  /** An academic year of that branch. */
  let academicYearId: string;
  /** A branch of the *second* organization — off limits to the org admin. */
  let foreignBranchId: string;

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
    const passwordService = app.get(PasswordService);
    await app.init();

    const stamp = Date.now();

    // Two organizations, so the scope is genuinely ambiguous for a SUPER_ADMIN.
    const first = await prisma.organization.create({
      data: {
        name: 'Context First Org',
        code: `ctx-first-${stamp}`,
        contactEmail: 'first@test.com',
        contactPhone: '1234567890',
        masterExpiryDate: new Date(Date.now() + 10000000),
      },
    });
    const second = await prisma.organization.create({
      data: {
        name: 'Context Second Org',
        code: `ctx-second-${stamp}`,
        contactEmail: 'second@test.com',
        contactPhone: '1234567890',
        masterExpiryDate: new Date(Date.now() + 10000000),
      },
    });
    firstOrgId = first.id;
    secondOrgId = second.id;

    // A branch and an academic year, so a request can name the specific level
    // without naming the levels above it.
    const branch = await prisma.branch.create({
      data: {
        organizationId: first.id,
        name: 'Context Branch',
        code: `ctx-branch-${stamp}`,
        institutionType: 'SCHOOL',
        contactEmail: 'branch@test.com',
        contactPhone: '1234567890',
        addressLine1: '1 Test Road',
        city: 'Testville',
        state: 'TS',
        country: 'IN',
        pincode: '000000',
      },
    });
    branchId = branch.id;

    const academicYear = await prisma.academicYear.create({
      data: {
        branchId: branch.id,
        name: `2026-27-${stamp}`,
        startDate: new Date('2026-06-01'),
        endDate: new Date('2027-05-31'),
        isActive: true,
        isSelected: true,
      },
    });
    academicYearId = academicYear.id;

    const foreignBranch = await prisma.branch.create({
      data: {
        organizationId: second.id,
        name: 'Context Foreign Branch',
        code: `ctx-foreign-${stamp}`,
        institutionType: 'SCHOOL',
        contactEmail: 'foreign@test.com',
        contactPhone: '1234567890',
        addressLine1: '2 Test Road',
        city: 'Testville',
        state: 'TS',
        country: 'IN',
        pincode: '000000',
      },
    });
    foreignBranchId = foreignBranch.id;

    const password = 'Password123!';
    const hash = await passwordService.hash(password);
    const superAdmin = await prisma.user.create({
      data: {
        fullName: 'Context Super Admin',
        username: `ctx-super-${stamp}`,
        email: `ctx-super-${stamp}@test.com`,
        phone: `888${stamp}`,
        passwordHash: hash,
        role: UserRole.SUPER_ADMIN,
      },
    });

    const orgAdmin = await prisma.user.create({
      data: {
        fullName: 'Context Org Admin',
        username: `ctx-orgadmin-${stamp}`,
        email: `ctx-orgadmin-${stamp}@test.com`,
        phone: `999${stamp}`,
        passwordHash: hash,
        role: UserRole.ORG_ADMIN,
        organizationId: first.id,
      },
    });

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: superAdmin.email, password });
    superAdminToken = login.body.data.accessToken;

    const orgAdminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: orgAdmin.email, password });
    orgAdminToken = orgAdminLogin.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('routes that precede a selection', () => {
    it('answers /auth/me with the organizations to choose from', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);

      const ids = (
        response.body.data.availableOrganizations as { id: string }[]
      ).map((org) => org.id);
      expect(ids).toEqual(expect.arrayContaining([firstOrgId, secondOrgId]));

      // Reported honestly as unselected rather than guessed on the user's behalf.
      expect(response.body.data.context.organizationId).toBeNull();
    });

    it('still honours a selection once the client makes one', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set(organizationHeaders(secondOrgId));

      expect(response.status).toBe(200);
      expect(response.body.data.context.organizationId).toBe(secondOrgId);
    });
  });

  describe('tenant administration', () => {
    it('lists organizations without one being selected', async () => {
      const response = await request(app.getHttpServer())
        .get('/organizations')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
    });

    it('reads one organization without one being selected', async () => {
      const response = await request(app.getHttpServer())
        .get(`/organizations/${firstOrgId}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(firstOrgId);
    });

    it('creates an organization without one being selected', async () => {
      const response = await request(app.getHttpServer())
        .post('/organizations')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Context Third Org',
          code: `ctx-third-${Date.now()}`,
          contactEmail: 'third@test.com',
          contactPhone: '9876543210',
          masterExpiryDate: '2030-12-31',
        });

      expect(response.status).toBe(201);
    });

    it('updates an organization without one being selected', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/organizations/${firstOrgId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ name: 'Context First Org Renamed' });

      expect(response.status).toBe(200);
    });
  });

  describe('a scoped route, given only the more specific scope', () => {
    it('derives the organization from the branch header alone', async () => {
      // The hierarchy is strict, so a named branch names its organization. A
      // client that sends only `x-branch-id` has not left anything ambiguous
      // and must not be asked to select.
      const response = await request(app.getHttpServer())
        .get('/branches')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set('x-branch-id', branchId);

      expect(response.status).toBe(200);
    });

    it('derives the branch and organization from the academic-year header alone', async () => {
      const response = await request(app.getHttpServer())
        .get('/branches')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set('x-academic-year-id', academicYearId);

      expect(response.status).toBe(200);
    });

    it('still refuses a branch outside the caller’s tenant', async () => {
      // Deriving is a lookup, not a grant: the derived organization is still
      // validated against the caller. An ORG_ADMIN of the first organization
      // naming a branch of the second is refused, not resolved.
      const response = await request(app.getHttpServer())
        .get('/branches')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .set('x-branch-id', foreignBranchId);

      expect(response.status).toBe(403);
    });
  });

  describe('the header names the shipped client sends', () => {
    it('accepts x-tenant-id as the organization', async () => {
      const response = await request(app.getHttpServer())
        .get('/branches')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set('x-tenant-id', firstOrgId);

      expect(response.status).toBe(200);
    });

    it('reports the selection made with x-tenant-id back on /auth/me', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set('x-tenant-id', secondOrgId);

      expect(response.status).toBe(200);
      expect(response.body.data.context.organizationId).toBe(secondOrgId);
    });

    it('accepts x-academic-year as the academic year', async () => {
      const response = await request(app.getHttpServer())
        .get('/branches')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set('x-tenant-id', firstOrgId)
        .set('x-branch-id', branchId)
        .set('x-academic-year', academicYearId);

      expect(response.status).toBe(200);
    });
  });

  describe('routes that operate inside a tenant', () => {
    it('still demands a selection, with the candidates to choose from', async () => {
      const response = await request(app.getHttpServer())
        .get('/branches')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(409);
      expect(JSON.stringify(response.body)).toContain(
        'CONTEXT_SELECTION_REQUIRED',
      );
    });

    it('proceeds once the client names the tenant', async () => {
      const response = await request(app.getHttpServer())
        .get('/branches')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set(organizationHeaders(firstOrgId));

      expect(response.status).toBe(200);
    });
  });
});
