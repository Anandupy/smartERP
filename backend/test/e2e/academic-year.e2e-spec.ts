import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { UserRole } from '@/common/enums/role.enum';
import { PrismaService } from '@/infrastructure/database/prisma.service';

describe('AcademicYearController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let branchId: string;
  const adminHeaders = {
    'x-role': UserRole.SUPER_ADMIN,
    'x-user-id': 'test-admin-id',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    prisma = app.get(PrismaService);
    await app.init();

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
        .set(adminHeaders)
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
        .set(adminHeaders);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });

    it('should fetch current academic year', async () => {
      const response = await request(app.getHttpServer())
        .get(`/academic-years/current?branchId=${branchId}`)
        .set(adminHeaders);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(yearId);
    });

    it('should lock academic year and prevent updates', async () => {
      await request(app.getHttpServer())
        .patch(`/academic-years/${yearId}/lock`)
        .set(adminHeaders)
        .send();

      const response = await request(app.getHttpServer())
        .patch(`/academic-years/${yearId}`)
        .set(adminHeaders)
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('locked');
    });

    it('should prevent overlapping years', async () => {
      const response = await request(app.getHttpServer())
        .post('/academic-years')
        .set(adminHeaders)
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
