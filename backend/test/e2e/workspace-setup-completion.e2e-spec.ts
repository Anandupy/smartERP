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
 * `POST /workspace/setup/complete` against a real app + database.
 *
 * This suite runs in the same long-lived e2e database every other spec in
 * this directory shares, where `workspace_state` is already `COMPLETED` — a
 * fresh-install (`setupRequired: true`) run is exercised at the unit level
 * instead (`workspace-setup.service.spec.ts`), since resetting the shared
 * global bootstrap flag here would destabilize every other e2e spec relying
 * on the strict, header-based context resolver. What this suite proves that a
 * mocked unit test cannot: the real `@Roles()` decorator, the real JWT-borne
 * `organizationId`, and `WorkspaceSetupService`'s new actor check all agree
 * end to end through the actual guard pipeline.
 */
describe('WorkspaceSetupController — complete (e2e)', () => {
  jest.setTimeout(30000);
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordService: PasswordService;
  let ctx: ContextHeaders & { organizationId: string };

  let superAdminToken: string;
  let staffToken: string;
  /** ORG_ADMIN with no organization assigned at all. */
  let unaffiliatedOrgAdminToken: string;
  /** ORG_ADMIN assigned to `ctx.organizationId`. */
  let scopedOrgAdminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    prisma = app.get(PrismaService);
    passwordService = app.get(PasswordService);
    await app.init();

    ctx = await createIsolatedContext(prisma as never, 'setupcomplete');

    const password = 'Password123!';
    const hash = await passwordService.hash(password);
    const stamp = Date.now();

    const superAdmin = await prisma.user.create({
      data: {
        fullName: 'Setup Super Admin',
        username: `setup-super-${stamp}`,
        email: `setup-super-${stamp}@test.com`,
        phone: `700${stamp}`.slice(0, 10),
        passwordHash: hash,
        role: UserRole.SUPER_ADMIN,
      },
    });

    const staff = await prisma.user.create({
      data: {
        fullName: 'Setup Staff',
        username: `setup-staff-${stamp}`,
        email: `setup-staff-${stamp}@test.com`,
        phone: `701${stamp}`.slice(0, 10),
        passwordHash: hash,
        role: UserRole.STAFF,
        organizationId: ctx.organizationId,
      },
    });

    const unaffiliatedOrgAdmin = await prisma.user.create({
      data: {
        fullName: 'Unaffiliated Org Admin',
        username: `setup-unaff-oa-${stamp}`,
        email: `setup-unaff-oa-${stamp}@test.com`,
        phone: `702${stamp}`.slice(0, 10),
        passwordHash: hash,
        role: UserRole.ORG_ADMIN,
        // Deliberately no organizationId — mirrors an ORG_ADMIN provisioned
        // before SUPER_ADMIN attached them to an organization (§8 of
        // docs/core/workspace-bootstrap.md).
      },
    });

    const scopedOrgAdmin = await prisma.user.create({
      data: {
        fullName: 'Scoped Org Admin',
        username: `setup-scoped-oa-${stamp}`,
        email: `setup-scoped-oa-${stamp}@test.com`,
        phone: `703${stamp}`.slice(0, 10),
        passwordHash: hash,
        role: UserRole.ORG_ADMIN,
        organizationId: ctx.organizationId,
      },
    });

    const login = async (identifier: string) => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ identifier, password });
      return response.body.data.accessToken as string;
    };

    superAdminToken = await login(superAdmin.email);
    staffToken = await login(staff.email);
    unaffiliatedOrgAdminToken = await login(unaffiliatedOrgAdmin.email);
    scopedOrgAdminToken = await login(scopedOrgAdmin.email);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects an unauthenticated request', () => {
    return request(app.getHttpServer())
      .post('/workspace/setup/complete')
      .expect(401);
  });

  it('rejects a role with no setup authority', () => {
    return request(app.getHttpServer())
      .post('/workspace/setup/complete')
      .set('Authorization', `Bearer ${staffToken}`)
      .set(ctx)
      .expect(403);
  });

  it('rejects an ORG_ADMIN with no organization resolved onto their scope', async () => {
    // No context headers, and this account has no organizationId of its own.
    // This workspace is already past setup, so `ExecutionContextGuard` uses
    // the *strict* resolver here, which throws its own 400 ("No active
    // organization available for user") before the request ever reaches
    // `WorkspaceSetupController` — RolesGuard and the controller never run.
    //
    // That is a different layer than the one this change added: during
    // actual bootstrap (`setupRequired: true`), `ExecutionContextGuard` uses
    // `resolveBootstrapContext` instead, which tolerates an unresolved scope
    // silently (`context.organizationId: null`) rather than throwing — it is
    // that path `WorkspaceSetupService.markInitialized`'s new actor check
    // exists to close, and it cannot be exercised against this suite's
    // already-initialized shared database. It is covered directly at the
    // unit level in `workspace-setup.service.spec.ts` ("refuses an
    // ORG_ADMIN with no resolved organization"), which calls `markInitialized`
    // with `organizationId: null` exactly as `resolveBootstrapContext` would
    // hand it off.
    //
    // Both layers agree on the outcome that matters here: an org-less
    // ORG_ADMIN can never complete setup, in either workspace state.
    const response = await request(app.getHttpServer())
      .post('/workspace/setup/complete')
      .set('Authorization', `Bearer ${unaffiliatedOrgAdminToken}`);

    expect(response.status).toBe(400);
  });

  it('allows an ORG_ADMIN resolved to their own organization', async () => {
    const response = await request(app.getHttpServer())
      .post('/workspace/setup/complete')
      .set('Authorization', `Bearer ${scopedOrgAdminToken}`)
      .set(ctx);

    // The shared e2e database is already past setup, so this is the
    // idempotent branch — the point of this assertion is that authorization
    // let the request all the way through to the service, not a 403.
    expect(response.status).toBe(201);
    expect(response.body.data.setupRequired).toBe(false);
  });

  it('allows SUPER_ADMIN unconditionally', async () => {
    const response = await request(app.getHttpServer())
      .post('/workspace/setup/complete')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .set(ctx);

    expect(response.status).toBe(201);
    expect(response.body.data.setupRequired).toBe(false);
  });
});
