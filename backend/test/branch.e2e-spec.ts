import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { UserRole } from '@/common/enums/role.enum';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { describe, it } from 'node:test';

describe('BranchController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let orgId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    prisma = app.get(PrismaService);
    await app.init();

    // Create a dummy organization for branch testing
    const org = await prisma.organization.create({
      data: {
        name: 'Branch Test Org',
        code: 'br-test-org-' + Date.now(),
        contactEmail: 'br@test.com',
        contactPhone: '1234567890',
        masterExpiryDate: new Date(),
      },
    });
    orgId = org.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/branches (POST)', () => {
    const createBranchDto = {
      organizationId: '', // Set in test
      name: 'Test Branch',
      code: 'test-branch-' + Date.now(),
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
        .set('x-role', UserRole.ORG_ADMIN)
        .send({ ...createBranchDto, organizationId: orgId });
      
      expect(response.status).toBe(201);
      expect(response.body.data.name).toBe(createBranchDto.name);
    });

    it('should return 403 for STAFF', () => {
      return request(app.getHttpServer())
        .post('/branches')
        .set('x-role', UserRole.STAFF)
        .send({ ...createBranchDto, organizationId: orgId })
        .expect(403);
    });
  });

  describe('/branches (GET)', () => {
    it('should allow STAFF to list branches (hierarchy)', () => {
      return request(app.getHttpServer())
        .get('/branches')
        .set('x-role', UserRole.STAFF)
        .expect(200);
    });
  });
});
function beforeAll(arg0: () => Promise<void>) {
  throw new Error('Function not implemented.');
}

function afterAll(arg0: () => Promise<void>) {
  throw new Error('Function not implemented.');
}

function expect(status: number) {
  throw new Error('Function not implemented.');
}

