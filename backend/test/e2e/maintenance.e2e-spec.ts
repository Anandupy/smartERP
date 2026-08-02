import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { UserRole } from '@/common/enums/role.enum';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PasswordService } from '@/common/services/password.service';
import { MaintenanceFeature } from '@/common/decorators/maintenance.decorator';
import { Controller, Get, Post, Req } from '@nestjs/common';
import { Public } from '@/common/decorators/public.decorator';
import { MaintenanceService } from '@/modules/maintenance/maintenance.service';
import { GlobalExceptionFilter } from '@/filters/global-exception.filter';
import { GlobalResponseInterceptor } from '@/interceptors/global-response.interceptor';
import { LoggerService } from '@/common/logger/logger.service';
import { RequireBranch } from '@/common/decorators/branch.decorator';

// A mock controller to test module/feature maintenance rules in isolation
@Controller('mock-feature')
class MockFeatureController {
  @RequireBranch({ optional: true })
  @Get('read')
  mockRead() {
    return { success: true, message: 'read success' };
  }

  @RequireBranch({ optional: true })
  @Post('write')
  mockWrite() {
    return { success: true, message: 'write success' };
  }

  @RequireBranch({ optional: true })
  @MaintenanceFeature('admission_creation')
  @Post('admission-create')
  mockAdmissionCreate() {
    return { success: true, message: 'admission created' };
  }
}

describe('Maintenance System (e2e)', () => {
  jest.setTimeout(30000);
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordService: PasswordService;
  let superAdminToken: string;
  let staffToken: string;
  let superAdmin: any;
  let staffUser: any;
  let orgId1: string;
  let orgId2: string;
  let branchId1: string;
  let branchId2: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [MockFeatureController],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    const logger = await app.resolve(LoggerService);
    app.useGlobalFilters(new GlobalExceptionFilter(logger));
    app.useGlobalInterceptors(new GlobalResponseInterceptor());
    prisma = app.get(PrismaService);
    passwordService = app.get(PasswordService);
    await app.init();

    const password = 'Password123!';
    const hash = await passwordService.hash(password);

    // Create Organizations
    const org1 = await prisma.organization.create({
      data: {
        name: 'Maintenance Org 1',
        code: 'maint-org-1-' + Date.now(),
        contactEmail: 'maint1@test.com',
        contactPhone: '1234567890',
        masterExpiryDate: new Date(Date.now() + 10000000),
      },
    });
    orgId1 = org1.id;

    const org2 = await prisma.organization.create({
      data: {
        name: 'Maintenance Org 2',
        code: 'maint-org-2-' + Date.now(),
        contactEmail: 'maint2@test.com',
        contactPhone: '1234567890',
        masterExpiryDate: new Date(Date.now() + 10000000),
      },
    });
    orgId2 = org2.id;

    // Create Branches
    const b1 = await prisma.branch.create({
      data: {
        organizationId: orgId1,
        name: 'Maint Branch 1',
        code: 'mb1-' + Date.now(),
        institutionType: 'SCHOOL',
        contactEmail: 'mb1@test.com',
        contactPhone: '1234567890',
        addressLine1: 'Addr 1',
        city: 'City 1',
        state: 'State 1',
        country: 'Country 1',
        pincode: '111111',
      },
    });
    branchId1 = b1.id;

    const b2 = await prisma.branch.create({
      data: {
        organizationId: orgId2,
        name: 'Maint Branch 2',
        code: 'mb2-' + Date.now(),
        institutionType: 'SCHOOL',
        contactEmail: 'mb2@test.com',
        contactPhone: '1234567890',
        addressLine1: 'Addr 2',
        city: 'City 2',
        state: 'State 2',
        country: 'Country 2',
        pincode: '222222',
      },
    });
    branchId2 = b2.id;

    // Create Users
    superAdmin = await prisma.user.create({
      data: {
        fullName: 'Maint Super Admin',
        username: 'msuper-' + Date.now(),
        email: 'msuper-' + Date.now() + '@test.com',
        phone: '111' + Math.floor(1000000 + Math.random() * 9000000),
        passwordHash: hash,
        role: UserRole.SUPER_ADMIN,
      },
    });

    staffUser = await prisma.user.create({
      data: {
        fullName: 'Maint Staff User',
        username: 'mstaff-' + Date.now(),
        email: 'mstaff-' + Date.now() + '@test.com',
        phone: '222' + Math.floor(1000000 + Math.random() * 9000000),
        passwordHash: hash,
        role: UserRole.STAFF,
        organizationId: orgId1,
        branchId: branchId1,
      },
    });

    // Login
    const superLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: superAdmin.email, password });
    superAdminToken = superLogin.body.data.accessToken;

    const staffLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: staffUser.email, password });
    staffToken = staffLogin.body.data.accessToken;
  });

  afterAll(async () => {
    await prisma.maintenanceRule.deleteMany({});
    await app.close();
  });

  beforeEach(async () => {
    await prisma.maintenanceRule.deleteMany({});
    app.get(MaintenanceService).invalidateCache();
  });

  describe('CRUD Operations (SUPER_ADMIN only)', () => {
    it('should create a maintenance rule successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/maintenance-rules')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set('x-organization-id', orgId1)
        .send({
          scopeType: 'GLOBAL',
          isActive: true,
          allowLogin: false,
          allowReadApis: true,
          allowWriteApis: false,
          title: 'Emergency Maintenance',
          shortMessage: 'Global maintenance is active.',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.scopeType).toBe('GLOBAL');
      expect(response.body.data.title).toBe('Emergency Maintenance');
    });

    it('should list all maintenance rules', async () => {
      await prisma.maintenanceRule.create({
        data: {
          scopeType: 'GLOBAL',
          isActive: true,
        },
      });

      const response = await request(app.getHttpServer())
        .get('/maintenance-rules')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set('x-organization-id', orgId1);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should fail CRUD if role is not SUPER_ADMIN', async () => {
      const response = await request(app.getHttpServer())
        .post('/maintenance-rules')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          scopeType: 'GLOBAL',
        });

      expect(response.status).toBe(403);
    });
  });

  describe('Pipeline Enforcement and Resolution', () => {
    it('should block read and write on GLOBAL maintenance', async () => {
      await prisma.maintenanceRule.create({
        data: {
          scopeType: 'GLOBAL',
          isActive: true,
          allowReadApis: false,
          allowWriteApis: false,
          customStatus: 503,
          title: 'Upgrade Underway',
          shortMessage: 'We are offline.',
        },
      });

      const res = await request(app.getHttpServer())
        .get('/mock-feature/read')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      // The unified response contract carries the code inside `error`.
      expect(res.body.error.code).toBe('MAINTENANCE_ACTIVE');
      // Failure payloads carry their structured detail under error.details;
      // `data` is null on every error in the unified response contract.
      expect(res.body.error.details.maintenanceEnabled).toBe(true);
      expect(res.body.error.details.title).toBe('Upgrade Underway');
    });

    it('should allow read and block write on Read-Only GLOBAL maintenance', async () => {
      await prisma.maintenanceRule.create({
        data: {
          scopeType: 'GLOBAL',
          isActive: true,
          allowReadApis: true,
          allowWriteApis: false,
        },
      });

      // GET should pass
      const readRes = await request(app.getHttpServer())
        .get('/mock-feature/read')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(readRes.status).toBe(200);

      // POST should fail
      const writeRes = await request(app.getHttpServer())
        .post('/mock-feature/write')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(writeRes.status).toBe(503);
    });

    it('should bypass maintenance for SUPER_ADMIN always', async () => {
      await prisma.maintenanceRule.create({
        data: {
          scopeType: 'GLOBAL',
          isActive: true,
          allowReadApis: false,
          allowWriteApis: false,
        },
      });

      const res = await request(app.getHttpServer())
        .get('/mock-feature/read')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set('x-organization-id', orgId1);

      expect(res.status).toBe(200);
    });

    it('should respect bypassRoles exceptions', async () => {
      await prisma.maintenanceRule.create({
        data: {
          scopeType: 'GLOBAL',
          isActive: true,
          allowReadApis: false,
          allowWriteApis: false,
          bypassRoles: ['STAFF'],
        },
      });

      const res = await request(app.getHttpServer())
        .get('/mock-feature/read')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
    });

    it('should scope maintenance to a single Organization', async () => {
      await prisma.maintenanceRule.create({
        data: {
          scopeType: 'ORGANIZATION',
          scopeId: orgId1,
          isActive: true,
          allowReadApis: false,
          allowWriteApis: false,
        },
      });

      // Staff User belongs to orgId1 -> Blocked
      const blockedRes = await request(app.getHttpServer())
        .get('/mock-feature/read')
        .set('Authorization', `Bearer ${staffToken}`)
        .set('x-branch-id', branchId1);
      expect(blockedRes.status).toBe(503);

      // Super admin can access or if request is sent under branchId2 (Org 2)
      const allowedRes = await request(app.getHttpServer())
        .get('/mock-feature/read')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set('x-organization-id', orgId2)
        .set('x-branch-id', branchId2);
      expect(allowedRes.status).toBe(200);
    });

    it('should scope maintenance to a single Branch', async () => {
      await prisma.maintenanceRule.create({
        data: {
          scopeType: 'BRANCH',
          scopeId: branchId1,
          isActive: true,
          allowReadApis: false,
          allowWriteApis: false,
        },
      });

      // Hit branchId1 -> Blocked
      const blockedRes = await request(app.getHttpServer())
        .get('/mock-feature/read')
        .set('Authorization', `Bearer ${staffToken}`)
        .set('x-branch-id', branchId1);
      expect(blockedRes.status).toBe(503);

      // Hit branchId2 -> Allowed
      const allowedRes = await request(app.getHttpServer())
        .get('/mock-feature/read')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set('x-organization-id', orgId2)
        .set('x-branch-id', branchId2);
      expect(allowedRes.status).toBe(200);
    });

    it('should scope maintenance to a Module', async () => {
      await prisma.maintenanceRule.create({
        data: {
          scopeType: 'MODULE',
          scopeId: 'mock-feature',
          isActive: true,
          allowReadApis: false,
          allowWriteApis: false,
        },
      });

      // Path '/mock-feature/read' belongs to module 'mock-feature' -> Blocked
      const res = await request(app.getHttpServer())
        .get('/mock-feature/read')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(503);
    });

    it('should scope maintenance to a Feature level', async () => {
      await prisma.maintenanceRule.create({
        data: {
          scopeType: 'FEATURE',
          scopeId: 'admission_creation',
          isActive: true,
          allowWriteApis: false,
        },
      });

      // Decorated with @MaintenanceFeature('admission_creation') -> Blocked
      const blockedRes = await request(app.getHttpServer())
        .post('/mock-feature/admission-create')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(blockedRes.status).toBe(503);

      // Undecorated route -> Allowed
      const allowedRes = await request(app.getHttpServer())
        .post('/mock-feature/write')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(allowedRes.status).toBe(201);
    });

    it('should respect scheduled start/end windows', async () => {
      const futureStart = new Date(Date.now() + 100000);
      const futureEnd = new Date(Date.now() + 200000);

      await prisma.maintenanceRule.create({
        data: {
          scopeType: 'GLOBAL',
          isActive: true,
          allowReadApis: false,
          allowWriteApis: false,
          startAt: futureStart,
          endAt: futureEnd,
        },
      });

      // Current time is before startAt -> Allowed
      const res = await request(app.getHttpServer())
        .get('/mock-feature/read')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(200);
    });
  });

  describe('Active Status API', () => {
    it('should return active status details correctly', async () => {
      await prisma.maintenanceRule.create({
        data: {
          scopeType: 'GLOBAL',
          isActive: true,
          allowReadApis: false,
          title: 'Dashboard Status Check',
        },
      });

      const res = await request(app.getHttpServer()).get(
        '/maintenance-rules/active/status',
      );

      expect(res.status).toBe(200);
      expect(res.body.data.maintenanceEnabled).toBe(true);
      expect(res.body.data.title).toBe('Dashboard Status Check');
    });
  });
});
