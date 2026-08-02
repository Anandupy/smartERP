import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PasswordService } from '@/common/services/password.service';
import { UserRole } from '@/common/enums/role.enum';
import { ProgramLevel } from '@/generated/client';
import { contextHeaders, ContextHeaders } from '../helpers/context.helper';

describe('ProgramController (e2e)', () => {
  jest.setTimeout(30000);
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordService: PasswordService;
  let accessToken: string;
  let branchId: string;
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

    // Setup: Create Organization, Branch, and Admin User
    const org = await prisma.organization.create({
      data: {
        name: 'Program Test Org',
        code: 'prog-org-' + Date.now(),
        contactEmail: 'prog@test.com',
        contactPhone: '1234567890',
        masterExpiryDate: new Date(Date.now() + 10000000),
      },
    });

    const branch = await prisma.branch.create({
      data: {
        organizationId: org.id,
        name: 'Program Test Branch',
        code: 'prog-br-' + Date.now(),
        institutionType: 'SCHOOL',
        contactEmail: 'br@test.com',
        contactPhone: '1234567890',
        addressLine1: 'Street 1',
        city: 'City',
        state: 'State',
        country: 'Country',
        pincode: '123456',
      },
    });
    branchId = branch.id;
    ctx = contextHeaders(org.id, branch.id);

    const password = 'Password123!';
    const hash = await passwordService.hash(password);
    const user = await prisma.user.create({
      data: {
        fullName: 'Program Admin',
        username: 'progadmin-' + Date.now(),
        email: 'progadmin-' + Date.now() + '@test.com',
        phone: '999' + Date.now(),
        passwordHash: hash,
        role: UserRole.SUPER_ADMIN,
      },
    });

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: user.email, password });

    accessToken = loginResponse.body.data.accessToken;
  });

  afterAll(async () => {
    await prisma.program.deleteMany({ where: { branchId } });
    await prisma.branch.delete({ where: { id: branchId } });
    await app.close();
  });

  describe('/programs (POST)', () => {
    it('should create a program', async () => {
      const response = await request(app.getHttpServer())
        .post('/programs')
        .set('Authorization', `Bearer ${accessToken}`)
        .set(ctx)
        .set('x-branch-id', branchId)
        .send({
          branchId,
          name: 'Primary',
          level: ProgramLevel.SCHOOL,
          medium: 'English',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.name).toBe('Primary');
    });

    it('should fail to create duplicate program', async () => {
      await request(app.getHttpServer())
        .post('/programs')
        .set('Authorization', `Bearer ${accessToken}`)
        .set(ctx)
        .set('x-branch-id', branchId)
        .send({
          branchId,
          name: 'Secondary',
          medium: 'Hindi',
        });

      const response = await request(app.getHttpServer())
        .post('/programs')
        .set('Authorization', `Bearer ${accessToken}`)
        .set(ctx)
        .set('x-branch-id', branchId)
        .send({
          branchId,
          name: 'Secondary',
          medium: 'Hindi',
        });

      expect(response.status).toBe(409);
    });
  });

  describe('/programs/tree (GET)', () => {
    it('should return hierarchical structure', async () => {
      const parent = await prisma.program.create({
        data: {
          branchId,
          name: 'Higher Secondary',
          medium: 'English',
        },
      });

      await prisma.program.create({
        data: {
          branchId,
          name: 'Science',
          parentId: parent.id,
          stream: 'Science',
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/programs/tree?branchId=${branchId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set(ctx)
        .set('x-branch-id', branchId);

      expect(response.status).toBe(200);
      const tree = response.body.data;
      const parentNode = tree.find((p: any) => p.id === parent.id);
      expect(parentNode.children.length).toBeGreaterThan(0);
    });
  });
});
