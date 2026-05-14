import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PasswordService } from '@/common/services/password.service';

describe('AuthController (e2e)', () => {
  jest.setTimeout(60000);
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

    it('should support multi-device login and session tracking', async () => {
      const password = 'Password123!';
      const hash = await passwordService.hash(password);
      const user = await prisma.user.create({
        data: {
          fullName: 'Multi Device User',
          username: 'multi-' + Date.now(),
          email: 'multi-' + Date.now() + '@test.com',
          phone: '999' + Date.now(),
          passwordHash: hash,
          role: 'STAFF',
        },
      });

      // Login 1 (Desktop)
      const login1 = await request(app.getHttpServer())
        .post('/auth/login')
        .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x86)')
        .send({ identifier: user.email, password });

      // Login 2 (Mobile)
      const login2 = await request(app.getHttpServer())
        .post('/auth/login')
        .set(
          'User-Agent',
          'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
        )
        .send({ identifier: user.email, password });

      const accessToken = login1.body.data.accessToken;

      // Check sessions
      const sessions = await request(app.getHttpServer())
        .get('/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(sessions.status).toBe(200);
      expect(sessions.body.data).toHaveLength(2);
      expect(sessions.body.data[0].device).toBe('Mobile');
      expect(sessions.body.data[1].device).toBe('Desktop');
    });
  });

  describe('Session Management', () => {
    let accessToken: string;
    let refreshToken: string;
    let userId: string;

    beforeAll(async () => {
      const password = 'Password123!';
      const hash = await passwordService.hash(password);
      const user = await prisma.user.create({
        data: {
          fullName: 'Session User',
          username: 'session-' + Date.now(),
          email: 'session-' + Date.now() + '@test.com',
          phone: '888' + Date.now(),
          passwordHash: hash,
          role: 'STAFF',
        },
      });
      userId = user.id;

      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ identifier: user.email, password });

      accessToken = login.body.data.accessToken;
      refreshToken = login.body.data.refreshToken;
    });

    it('should refresh token and rotate', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken });

      expect(response.status).toBe(201);
      expect(response.body.data.refreshToken).not.toBe(refreshToken);

      // Old token should be revoked
      const oldTokenRecord = await prisma.refreshToken.findFirst({
        where: { token: refreshToken },
      });
      expect(oldTokenRecord?.isRevoked).toBe(true);
    });

    it('should revoke all sessions', async () => {
      const response = await request(app.getHttpServer())
        .delete('/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);

      const activeSessions = await prisma.refreshToken.findMany({
        where: { userId, isRevoked: false },
      });
      expect(activeSessions).toHaveLength(0);
    });
  });
});
