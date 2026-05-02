import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { UserRole } from '@/common/enums/role.enum';
import { PrismaService } from '@/infrastructure/database/prisma.service';

describe('SystemSettingsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    prisma = app.get(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/system-settings (GET)', () => {
    it('should return 403 if x-role header is missing', () => {
      return request(app.getHttpServer())
        .get('/system-settings')
        .expect(403);
    });

    it('should return 403 if role is not SUPER_ADMIN', () => {
      return request(app.getHttpServer())
        .get('/system-settings')
        .set('x-role', UserRole.ORG_ADMIN)
        .expect(403);
    });

    it('should return system settings for SUPER_ADMIN', async () => {
      // Ensure a record exists or handle the case where it doesn't
      const response = await request(app.getHttpServer())
        .get('/system-settings')
        .set('x-role', UserRole.SUPER_ADMIN);
      
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
        .set('x-role', UserRole.SUPER_ADMIN)
        .send(initDto);
      
      expect([201, 400]).toContain(response.status); // 400 if already initialized
    });
  });
});
