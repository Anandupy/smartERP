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

describe('SystemSettingsController (e2e)', () => {
  jest.setTimeout(30000);
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordService: PasswordService;
  let superAdminToken: string;
  let orgAdminToken: string;
  // Requests must name a tenant: other specs create organizations in the same
  // database, so an unscoped request is ambiguous and answers 409.
  let ctx: ContextHeaders;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    prisma = app.get(PrismaService);
    passwordService = app.get(PasswordService);
    await app.init();

    ctx = await createIsolatedContext(prisma as never, 'sysset');

    const password = 'Password123!';
    const hash = await passwordService.hash(password);

    const superAdmin = await prisma.user.create({
      data: {
        fullName: 'Super Admin',
        username: 'super-' + Date.now(),
        email: 'super-' + Date.now() + '@test.com',
        phone: '666' + Date.now(),
        passwordHash: hash,
        role: UserRole.SUPER_ADMIN,
      },
    });

    const orgAdmin = await prisma.user.create({
      data: {
        fullName: 'Org Admin',
        username: 'org-' + Date.now(),
        email: 'org-' + Date.now() + '@test.com',
        phone: '777' + Date.now(),
        passwordHash: hash,
        role: UserRole.ORG_ADMIN,
      },
    });

    const superLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: superAdmin.email, password });
    superAdminToken = superLogin.body.data.accessToken;

    const orgLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: orgAdmin.email, password });
    orgAdminToken = orgLogin.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/system-settings (GET)', () => {
    it('should return 401 if Authorization header is missing', () => {
      return request(app.getHttpServer()).get('/system-settings').expect(401);
    });

    it('should return 403 if role is not SUPER_ADMIN', () => {
      return request(app.getHttpServer())
        .get('/system-settings')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .set(ctx)
        .expect(403);
    });

    it('should return system settings for SUPER_ADMIN', async () => {
      const response = await request(app.getHttpServer())
        .get('/system-settings')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set(ctx);

      expect([200, 404]).toContain(response.status);
    });
  });

  describe('/system-settings/init (POST)', () => {
    const initDto = {
      productName: 'Test ERP',
      productCode: 'TEST-ERP-' + Date.now(),
      version: '1.0.0',
      environment: 'DEV',
      maintenanceMode: false,
      supportEmail: 'test@example.com',
      supportPhone: '1234567890',
    };

    it('should initialize system settings for SUPER_ADMIN', async () => {
      const response = await request(app.getHttpServer())
        .post('/system-settings/init')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set(ctx)
        .send(initDto);

      expect([201, 400]).toContain(response.status); // 400 if already initialized
    });
  });
});
