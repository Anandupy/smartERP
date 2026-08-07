import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { UserRole } from '@/common/enums/role.enum';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PasswordService } from '@/common/services/password.service';
import {
  createIsolatedContext,
  ContextHeaders,
} from '../helpers/context.helper';

/**
 * The audit read API, pinned to the shape it actually returns.
 *
 * `GET /audit-logs` nests its pagination **inside `data`** as `{ items, meta }`
 * — the shape `@ApiPaginatedItemsEnvelope` documents — rather than lifting it
 * onto the envelope's `meta.pagination` as the other list endpoints do. Both
 * conventions exist in this API and each is documented per endpoint, so the
 * only way a client gets this right is if the shape is asserted somewhere. It
 * was not, and a consumer read the other convention and rendered nothing.
 *
 * The summary and timeline payloads are pinned for the same reason: their keys
 * (`totalCount`, `dailyActivity`, `events`) are what a client must look for.
 */
describe('AuditController (e2e)', () => {
  jest.setTimeout(30000);
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdminToken: string;
  let ctx: ContextHeaders;
  let organizationId: string;
  let branchId: string;

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

    const scope = await createIsolatedContext(prisma as never, 'audit');
    ctx = scope;
    organizationId = scope.organizationId;
    branchId = scope.branchId;

    const stamp = Date.now();
    const password = 'Password123!';
    const hash = await passwordService.hash(password);
    const superAdmin = await prisma.user.create({
      data: {
        fullName: 'Audit Super Admin',
        username: `audit-super-${stamp}`,
        email: `audit-super-${stamp}@test.com`,
        phone: `666${stamp}`,
        passwordHash: hash,
        role: UserRole.SUPER_ADMIN,
      },
    });

    // Three records in this spec's own organization, spread over three days so
    // the timeline has more than one bucket.
    await prisma.auditLog.createMany({
      data: [
        {
          timestamp: new Date('2026-01-01T10:00:00.000Z'),
          eventName: 'organization.created',
          action: 'CREATE',
          module: 'ORGANIZATION',
          aggregateType: 'Organization',
          aggregateId: organizationId,
          userId: superAdmin.id,
          userEmail: superAdmin.email,
          role: UserRole.SUPER_ADMIN,
          organizationId,
          severity: 'INFO',
          status: 'SUCCESS',
          metadata: { seeded: true },
        },
        {
          timestamp: new Date('2026-01-02T10:00:00.000Z'),
          eventName: 'branch.created',
          action: 'CREATE',
          module: 'ORGANIZATION',
          aggregateType: 'Branch',
          aggregateId: branchId,
          userId: superAdmin.id,
          userEmail: superAdmin.email,
          role: UserRole.SUPER_ADMIN,
          organizationId,
          branchId,
          severity: 'INFO',
          status: 'SUCCESS',
        },
        {
          timestamp: new Date('2026-01-03T10:00:00.000Z'),
          eventName: 'academic_year.updated',
          action: 'UPDATE',
          module: 'ACADEMIC',
          aggregateType: 'AcademicYear',
          aggregateId: 'ay-seed',
          userId: superAdmin.id,
          userEmail: superAdmin.email,
          role: UserRole.SUPER_ADMIN,
          organizationId,
          branchId,
          severity: 'WARN',
          status: 'SUCCESS',
        },
      ],
    });

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: superAdmin.email, password });
    superAdminToken = login.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  const list = (query = '') =>
    request(app.getHttpServer())
      .get(`/audit-logs${query}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .set(ctx);

  describe('GET /audit-logs', () => {
    it('nests the page and its pagination inside data', async () => {
      const response = await list(`?organizationId=${organizationId}`);

      expect(response.status).toBe(200);
      // The contract a client has to code against: an object, not an array.
      expect(Array.isArray(response.body.data)).toBe(false);
      expect(Array.isArray(response.body.data.items)).toBe(true);
      expect(response.body.data.meta).toEqual({
        total: expect.any(Number),
        page: expect.any(Number),
        limit: expect.any(Number),
        totalPages: expect.any(Number),
      });
      // And pagination is *not* on the envelope, which is where the platform's
      // other list endpoints put it.
      expect(response.body.meta?.pagination).toBeUndefined();
    });

    it('returns the seeded records with every documented field', async () => {
      const response = await list(`?organizationId=${organizationId}`);
      const row = (response.body.data.items as Record<string, unknown>[]).find(
        (item) => item.eventName === 'branch.created',
      );

      expect(row).toBeDefined();
      expect(row).toMatchObject({
        id: expect.any(String),
        timestamp: expect.any(String),
        eventName: 'branch.created',
        action: 'CREATE',
        module: 'ORGANIZATION',
        aggregateType: 'Branch',
        aggregateId: branchId,
        organizationId,
        branchId,
        severity: 'INFO',
        status: 'SUCCESS',
      });
      // A date is serialized as an ISO string, which is what the client parses.
      expect(() => new Date(row!.timestamp as string).toISOString()).not.toThrow();
    });

    it('omits metadata and changes unless includeDetails is set', async () => {
      const without = await list(`?organizationId=${organizationId}`);
      expect(without.body.data.items[0]).not.toHaveProperty('metadata');

      const withDetails = await list(
        `?organizationId=${organizationId}&includeDetails=true`,
      );
      expect(withDetails.body.data.items[0]).toHaveProperty('metadata');
    });

    it('paginates', async () => {
      const response = await list(
        `?organizationId=${organizationId}&page=1&limit=2`,
      );

      expect(response.body.data.items).toHaveLength(2);
      expect(response.body.data.meta.limit).toBe(2);
      expect(response.body.data.meta.page).toBe(1);
      expect(response.body.data.meta.total).toBeGreaterThanOrEqual(3);
    });

    it('sorts', async () => {
      const response = await list(
        `?organizationId=${organizationId}&sortBy=timestamp&sortOrder=asc&limit=3`,
      );

      const stamps = (
        response.body.data.items as { timestamp: string }[]
      ).map((item) => new Date(item.timestamp).getTime());
      expect(stamps).toEqual([...stamps].sort((a, b) => a - b));
    });

    it('filters by module', async () => {
      const response = await list(
        `?organizationId=${organizationId}&module=ACADEMIC`,
      );

      const modules = new Set(
        (response.body.data.items as { module: string }[]).map(
          (item) => item.module,
        ),
      );
      expect([...modules]).toEqual(['ACADEMIC']);
    });

    it('searches', async () => {
      const response = await list(
        `?organizationId=${organizationId}&search=academic_year`,
      );

      expect(response.body.data.items.length).toBeGreaterThan(0);
      expect(
        (response.body.data.items as { eventName: string }[]).every((item) =>
          item.eventName.includes('academic_year'),
        ),
      ).toBe(true);
    });
  });

  describe('GET /audit-logs/summary', () => {
    it('returns totalCount and the four distributions', async () => {
      const response = await request(app.getHttpServer())
        .get(`/audit-logs/summary?organizationId=${organizationId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set(ctx);

      expect(response.status).toBe(200);
      expect(response.body.data.totalCount).toBeGreaterThanOrEqual(3);
      expect(response.body.data.byModule).toEqual(
        expect.arrayContaining([
          { module: expect.any(String), count: expect.any(Number) },
        ]),
      );
      expect(response.body.data).toHaveProperty('byAction');
      expect(response.body.data).toHaveProperty('bySeverity');
      expect(response.body.data).toHaveProperty('byStatus');
    });
  });

  describe('GET /audit-logs/timeline', () => {
    it('returns dailyActivity and events', async () => {
      const response = await request(app.getHttpServer())
        .get(`/audit-logs/timeline?organizationId=${organizationId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set(ctx);

      expect(response.status).toBe(200);
      // The key is `dailyActivity` — not `daily`, `trends` or `points`.
      expect(response.body.data.dailyActivity).toEqual(
        expect.arrayContaining([
          { date: expect.any(String), count: expect.any(Number) },
        ]),
      );
      expect(Array.isArray(response.body.data.events)).toBe(true);
    });
  });

  describe('GET /audit-logs/:id', () => {
    it('returns one record including metadata', async () => {
      const seeded = await prisma.auditLog.findFirst({
        where: { organizationId, eventName: 'organization.created' },
      });

      const response = await request(app.getHttpServer())
        .get(`/audit-logs/${seeded!.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set(ctx);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(seeded!.id);
      expect(response.body.data.metadata).toEqual({ seeded: true });
    });

    it('answers 404 for an id that does not exist', async () => {
      const response = await request(app.getHttpServer())
        .get('/audit-logs/019fcdae-0000-7000-8000-000000000000')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set(ctx);

      expect(response.status).toBe(404);
    });
  });
});
