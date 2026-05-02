import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PasswordService } from '@/common/services/password.service';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordService: PasswordService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    prisma = app.get(PrismaService);
    passwordService = app.get(PasswordService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/auth/login (POST)', () => {
    it('should login and return tokens', async () => {
      const password = 'Password123!';
      const hash = await passwordService.hash(password);
      
      const user = await prisma.user.create({
        data: {
          fullName: 'Auth Test User',
          username: 'authtest-' + Date.now(),
          email: 'auth-' + Date.now() + '@test.com',
          phone: '123' + Date.now(),
          passwordHash: hash,
          role: 'STAFF',
        },
      });

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ identifier: user.email, password });
      
      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
    });

    it('should return 401 for invalid password', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ identifier: 'nonexistent@test.com', password: 'wrong' });
      
      expect(response.status).toBe(401);
    });
  });
});
