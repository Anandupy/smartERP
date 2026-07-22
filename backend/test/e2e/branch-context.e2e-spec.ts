import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { UserRole } from '@/common/enums/role.enum';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PasswordService } from '@/common/services/password.service';

describe('Branch Context Pipeline (e2e)', () => {
  jest.setTimeout(30000);
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordService: PasswordService;
  let accessToken: string;
  let branchId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
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
      .post('/v1/auth/login')
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
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Header Validation Pipeline', () => {
    it('should fail with 400 when x-branch-id header is missing on @RequireBranch route', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/programs')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Branch context');
    });

    it('should fail with 400 when x-branch-id is an invalid UUID', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/programs')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-branch-id', 'invalid-branch-uuid');

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid Branch ID format');
    });

    it('should fail with 404 when branchId does not exist', async () => {
      const nonExistentUuid = '00000000-0000-7000-a000-000000000000';
      const res = await request(app.getHttpServer())
        .get('/v1/programs')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-branch-id', nonExistentUuid);

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Branch not found');
    });

    it('should succeed with 200 when valid x-branch-id is provided', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/programs')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-branch-id', branchId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
