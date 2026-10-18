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

describe('OrganizationController (e2e)', () => {
  jest.setTimeout(30000);
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordService: PasswordService;
  let superAdminToken: string;
  let orgAdminToken: string;
  // Requests must name a tenant: specs share one database and each creates
  // organizations, so an unscoped request is ambiguous and answers 409.
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

    ctx = await createIsolatedContext(prisma as never, 'org');

    const password = 'Password123!';
    const hash = await passwordService.hash(password);

    const superAdmin = await prisma.user.create({
      data: {
        fullName: 'Super Admin',
        username: 'super-' + Date.now(),
        email: 'super-' + Date.now() + '@test.com',
        phone: '444' + Date.now(),
        passwordHash: hash,
        role: UserRole.SUPER_ADMIN,
      },
    });

    const orgAdmin = await prisma.user.create({
      data: {
        fullName: 'Org Admin',
        username: 'org-' + Date.now(),
        email: 'org-' + Date.now() + '@test.com',
        phone: '555' + Date.now(),
        passwordHash: hash,
        role: UserRole.ORG_ADMIN,
        // An organization administrator belongs to the organization it
        // administers; one with none is refused any organization header.
        organizationId: ctx.organizationId,
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

  describe('/organizations (POST)', () => {
    const createDto = {
      name: 'Test Organization',
      code: 'test-org-' + Date.now(),
      contactEmail: 'org@test.com',
      contactPhone: '9876543210',
      masterExpiryDate: new Date().toISOString(),
    };

    it('should create organization for SUPER_ADMIN', async () => {
      const response = await request(app.getHttpServer())
        .post('/organizations')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set(ctx)
        .send(createDto);

      expect(response.status).toBe(201);
      expect(response.body.data.name).toBe(createDto.name);
    });

    it('should return 403 for ORG_ADMIN', () => {
      return request(app.getHttpServer())
        .post('/organizations')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .set(ctx)
        .send(createDto)
        .expect(403);
    });
  });

  describe('/organizations (GET)', () => {
    it('should allow ORG_ADMIN to list organizations', () => {
      return request(app.getHttpServer())
        .get('/organizations')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .set(ctx)
        .expect(200);
    });
  });
});
