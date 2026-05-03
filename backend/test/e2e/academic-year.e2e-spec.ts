import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { UserRole } from '@/common/enums/role.enum';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PasswordService } from '@/common/services/password.service';

describe('AcademicYearController (e2e)', () => {
  jest.setTimeout(30000);
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordService: PasswordService;
  let branchId: string;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    prisma = app.get(PrismaService);
    passwordService = app.get(PasswordService);
    await app.init();

    // Create a real admin user for testing
    const password = 'Password123!';
    const hash = await passwordService.hash(password);
    const user = await prisma.user.create({
      data: {
        fullName: 'Admin User',
        username: 'admin-' + Date.now(),
        email: 'admin-' + Date.now() + '@test.com',
        phone: '111' + Date.now(),
        passwordHash: hash,
        role: UserRole.SUPER_ADMIN,
      },
    });

    // Login to get token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: user.email, password });

    accessToken = loginResponse.body.data.accessToken;

    // Create a branch for testing
    const org = await prisma.organization.create({
      data: {
        name: 'Test Org',
        code: 'TORG-' + Date.now(),
        contactEmail: 'org@test.com',
        contactPhone: '1234567890',
        masterExpiryDate: new Date(Date.now() + 1000000),
      },
    });

    const branch = await prisma.branch.create({
      data: {
        organizationId: org.id,
        name: 'Test Branch',
        code: 'TBR-' + Date.now(),
        institutionType: 'SCHOOL',
        contactEmail: 'branch@test.com',
        contactPhone: '1234567890',
        addressLine1: 'Test Address',
        city: 'Test City',
        state: 'Test State',
        country: 'Test Country',
        pincode: '123456',
      },
    });
    branchId = branch.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('CRUD Operations', () => {
    let yearId: string;

    it('should create an academic year and auto-select it', async () => {
      const response = await request(app.getHttpServer())
        .post('/academic-years')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: '2025-26',
          startDate: '2025-04-01T00:00:00.000Z',
          endDate: '2026-03-31T00:00:00.000Z',
          branchId,
        });

      expect(response.status).toBe(201);
      expect(response.body.data.isSelected).toBe(true);
      yearId = response.body.data.id;
    });

    it('should fetch all academic years for branch', async () => {
      const response = await request(app.getHttpServer())
        .get(`/academic-years?branchId=${branchId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });

    it('should fetch current academic year', async () => {
      const response = await request(app.getHttpServer())
        .get(`/academic-years/current?branchId=${branchId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(yearId);
    });

    it('should lock academic year and prevent updates', async () => {
      await request(app.getHttpServer())
        .patch(`/academic-years/${yearId}/lock`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send();

      const response = await request(app.getHttpServer())
        .patch(`/academic-years/${yearId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('locked');
    });

    it('should prevent overlapping years', async () => {
      const response = await request(app.getHttpServer())
        .post('/academic-years')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: '2025-26 Overlap',
          startDate: '2025-06-01T00:00:00.000Z',
          endDate: '2026-06-01T00:00:00.000Z',
          branchId,
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('overlaps');
    });
  });
});
