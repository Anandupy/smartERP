import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { UserRole } from '@/common/enums/role.enum';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PasswordService } from '@/common/services/password.service';
import { organizationHeaders, ContextHeaders } from '../helpers/context.helper';

describe('UserController (e2e)', () => {
  jest.setTimeout(30000);
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordService: PasswordService;

  let orgAId: string;
  let orgBId: string;
  let ctxA: ContextHeaders;
  let ctxB: ContextHeaders;

  let superAdminToken: string;
  let orgAdminAToken: string;
  let orgAdminBToken: string;

  const password = 'Password123!';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    prisma = app.get(PrismaService);
    passwordService = app.get(PasswordService);
    await app.init();

    const [orgA, orgB] = await Promise.all([
      prisma.organization.create({
        data: {
          name: 'User Test Org A',
          code: 'user-test-org-a-' + Date.now(),
          contactEmail: 'usera@test.com',
          contactPhone: '1234500001',
          masterExpiryDate: new Date(Date.now() + 1000000),
        },
      }),
      prisma.organization.create({
        data: {
          name: 'User Test Org B',
          code: 'user-test-org-b-' + Date.now(),
          contactEmail: 'userb@test.com',
          contactPhone: '1234500002',
          masterExpiryDate: new Date(Date.now() + 1000000),
        },
      }),
    ]);
    orgAId = orgA.id;
    orgBId = orgB.id;
    ctxA = organizationHeaders(orgAId);
    ctxB = organizationHeaders(orgBId);

    const hash = await passwordService.hash(password);

    const [superAdmin, orgAdminA, orgAdminB] = await Promise.all([
      prisma.user.create({
        data: {
          fullName: 'Super Admin',
          username: 'super-user-' + Date.now(),
          email: 'super-user-' + Date.now() + '@test.com',
          phone: '811' + Date.now().toString().slice(-7),
          passwordHash: hash,
          role: UserRole.SUPER_ADMIN,
        },
      }),
      prisma.user.create({
        data: {
          fullName: 'Org Admin A',
          username: 'org-admin-a-' + Date.now(),
          email: 'org-admin-a-' + Date.now() + '@test.com',
          phone: '812' + Date.now().toString().slice(-7),
          passwordHash: hash,
          role: UserRole.ORG_ADMIN,
          organizationId: orgAId,
        },
      }),
      prisma.user.create({
        data: {
          fullName: 'Org Admin B',
          username: 'org-admin-b-' + Date.now(),
          email: 'org-admin-b-' + Date.now() + '@test.com',
          phone: '813' + Date.now().toString().slice(-7),
          passwordHash: hash,
          role: UserRole.ORG_ADMIN,
          organizationId: orgBId,
        },
      }),
    ]);

    const login = async (identifier: string) => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ identifier, password });
      return res.body.data.accessToken as string;
    };

    superAdminToken = await login(superAdmin.email);
    orgAdminAToken = await login(orgAdminA.email);
    orgAdminBToken = await login(orgAdminB.email);
  });

  afterAll(async () => {
    await app.close();
  });

  let userCounter = 0;

  const newUserDto = (overrides: Record<string, unknown> = {}) => {
    const stamp = (Date.now() % 100000000) + userCounter++;
    return {
      fullName: 'New User',
      // Letters, numbers and underscores only — CreateUserDto rejects hyphens.
      username: 'new_user_' + stamp,
      email: 'new-user-' + stamp + '@test.com',
      // IsPhoneNumber() with no region requires E.164 (leading country code).
      phone: '+9198' + stamp.toString().padStart(8, '0'),
      password: 'Password123!',
      role: 'STAFF',
      ...overrides,
    };
  };

  describe('POST /users — role assignment authorization', () => {
    it('lets SUPER_ADMIN provision an ORG_ADMIN scoped to an organization', async () => {
      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(newUserDto({ role: 'ORG_ADMIN', organizationId: orgAId }));

      expect(response.status).toBe(201);
      expect(response.body.data.role).toBe('ORG_ADMIN');
      expect(response.body.data.organizationId).toBe(orgAId);
    });

    it('rejects ORG_ADMIN attempting to create another ORG_ADMIN', async () => {
      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${orgAdminAToken}`)
        .set(ctxA)
        .send(newUserDto({ role: 'ORG_ADMIN' }));

      expect(response.status).toBe(403);
    });

    it('rejects ORG_ADMIN attempting to escalate to SUPER_ADMIN', async () => {
      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${orgAdminAToken}`)
        .set(ctxA)
        .send(newUserDto({ role: 'SUPER_ADMIN' }));

      expect(response.status).toBe(403);
    });

    it('lets ORG_ADMIN create a STAFF user, defaulted into their own organization', async () => {
      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${orgAdminAToken}`)
        .set(ctxA)
        .send(newUserDto({ role: 'STAFF' }));

      expect(response.status).toBe(201);
      expect(response.body.data.organizationId).toBe(orgAId);
    });
  });

  describe('POST /users — tenant isolation', () => {
    it('rejects an ORG_ADMIN naming a different organization in the body', async () => {
      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${orgAdminAToken}`)
        .set(ctxA)
        .send(newUserDto({ role: 'STAFF', organizationId: orgBId }));

      expect(response.status).toBe(403);
    });

    it('SUPER_ADMIN may target either organization', async () => {
      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(newUserDto({ role: 'STAFF', organizationId: orgBId }));

      expect(response.status).toBe(201);
      expect(response.body.data.organizationId).toBe(orgBId);
    });
  });

  describe('GET /users/:id — cross-tenant read', () => {
    it('rejects ORG_ADMIN A reading a user that belongs to organization B', async () => {
      const created = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${orgAdminBToken}`)
        .set(ctxB)
        .send(newUserDto({ role: 'STAFF' }));

      const response = await request(app.getHttpServer())
        .get(`/users/${created.body.data.id}`)
        .set('Authorization', `Bearer ${orgAdminAToken}`)
        .set(ctxA);

      expect(response.status).toBe(403);
    });

    it('lets ORG_ADMIN A read a user that belongs to their own organization', async () => {
      const created = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${orgAdminAToken}`)
        .set(ctxA)
        .send(newUserDto({ role: 'STAFF' }));

      const response = await request(app.getHttpServer())
        .get(`/users/${created.body.data.id}`)
        .set('Authorization', `Bearer ${orgAdminAToken}`)
        .set(ctxA);

      expect(response.status).toBe(200);
    });
  });

  describe('PATCH /users/:id — cross-tenant and escalation guards', () => {
    it('rejects ORG_ADMIN A updating a user that belongs to organization B', async () => {
      const created = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${orgAdminBToken}`)
        .set(ctxB)
        .send(newUserDto({ role: 'STAFF' }));

      const response = await request(app.getHttpServer())
        .patch(`/users/${created.body.data.id}`)
        .set('Authorization', `Bearer ${orgAdminAToken}`)
        .set(ctxA)
        .send({ fullName: 'Hijacked Name' });

      expect(response.status).toBe(403);
    });

    it('rejects ORG_ADMIN escalating an existing user to SUPER_ADMIN', async () => {
      const created = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${orgAdminAToken}`)
        .set(ctxA)
        .send(newUserDto({ role: 'STAFF' }));

      const response = await request(app.getHttpServer())
        .patch(`/users/${created.body.data.id}`)
        .set('Authorization', `Bearer ${orgAdminAToken}`)
        .set(ctxA)
        .send({ role: 'SUPER_ADMIN' });

      expect(response.status).toBe(403);
    });
  });
});
