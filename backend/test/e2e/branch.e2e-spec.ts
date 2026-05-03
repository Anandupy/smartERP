import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { UserRole } from '@/common/enums/role.enum';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PasswordService } from '@/common/services/password.service';

describe('BranchController (e2e)', () => {
  jest.setTimeout(30000);
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordService: PasswordService;
  let orgId: string;
  let orgAdminToken: string;
  let staffToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    prisma = app.get(PrismaService);
    passwordService = app.get(PasswordService);
    await app.init();

    // Create a dummy organization for branch testing
    const org = await prisma.organization.create({
      data: {
        name: 'Branch Test Org',
        code: 'br-test-org-' + Date.now(),
        contactEmail: 'br@test.com',
        contactPhone: '1234567890',
        masterExpiryDate: new Date(Date.now() + 1000000),
      },
    });
    orgId = org.id;

    // Create users and get tokens
    const password = 'Password123!';
    const hash = await passwordService.hash(password);

    const admin = await prisma.user.create({
      data: {
        fullName: 'Org Admin',
        username: 'admin-' + Date.now(),
        email: 'admin-' + Date.now() + '@test.com',
        phone: '222' + Date.now(),
        passwordHash: hash,
        role: UserRole.ORG_ADMIN,
        organizationId: orgId,
      },
    });

    const staff = await prisma.user.create({
      data: {
        fullName: 'Staff User',
        username: 'staff-' + Date.now(),
        email: 'staff-' + Date.now() + '@test.com',
        phone: '333' + Date.now(),
        passwordHash: hash,
        role: UserRole.STAFF,
        organizationId: orgId,
      },
    });

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: admin.email, password });
    orgAdminToken = adminLogin.body.data.accessToken;

    const staffLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: staff.email, password });
    staffToken = staffLogin.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/branches (POST)', () => {
    const createBranchDto = {
      organizationId: '', // Set in test
      name: 'Test Branch',
      code: 'test-branch-' + Date.now(),
      institutionType: 'SCHOOL',
      contactEmail: 'branch@test.com',
      contactPhone: '1234567890',
      addressLine1: 'Street 1',
      city: 'City',
      state: 'State',
      country: 'Country',
      pincode: '123456',
    };

    it('should create branch for ORG_ADMIN', async () => {
      const response = await request(app.getHttpServer())
        .post('/branches')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ ...createBranchDto, organizationId: orgId });

      expect(response.status).toBe(201);
      expect(response.body.data.name).toBe(createBranchDto.name);
    });

    it('should return 403 for STAFF', () => {
      return request(app.getHttpServer())
        .post('/branches')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ ...createBranchDto, organizationId: orgId })
        .expect(403);
    });
  });

  describe('/branches (GET)', () => {
    it('should allow STAFF to list branches (hierarchy)', () => {
      return request(app.getHttpServer())
        .get('/branches')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
    });
  });
});
