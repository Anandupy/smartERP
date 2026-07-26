import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PasswordService } from '@/common/services/password.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { OtpPurpose } from '@/generated/client';

describe('AuthController Recovery & Verification (e2e)', () => {
  jest.setTimeout(60000);
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordService: PasswordService;
  let eventBus: EventBus;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    prisma = app.get(PrismaService);
    passwordService = app.get(PasswordService);
    eventBus = app.get(EventBus);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Password Recovery (Forgot/Reset)', () => {
    let email: string;
    let userId: string;

    beforeEach(async () => {
      const password = 'OldPassword123!';
      const hash = await passwordService.hash(password);
      email = `recover-${Date.now()}@test.com`;

      const user = await prisma.user.create({
        data: {
          fullName: 'Recovery User',
          username: `recover-${Date.now()}`,
          email,
          phone: `phone-${Date.now()}`,
          passwordHash: hash,
          role: 'STAFF',
        },
      });
      userId = user.id;
    });

    it('should request forgot password and return generic success', async () => {
      const eventSpy = jest.spyOn(eventBus, 'publish');

      const response = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email });

      expect(response.status).toBe(201);
      expect(response.body.message).toContain('If the email matches');

      // Check if event was published
      const publishedResetEvent = eventSpy.mock.calls.find(
        (call) => call[0].eventName === 'communication.password_reset_requested',
      )?.[0] as any;

      expect(publishedResetEvent).toBeDefined();
      expect(publishedResetEvent.payload.email).toBe(email);
      expect(publishedResetEvent.payload.resetToken).toBeDefined();

      eventSpy.mockRestore();
    });

    it('should return generic success for nonexistent email without emitting event', async () => {
      const eventSpy = jest.spyOn(eventBus, 'publish');

      const response = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'fake-nonexistent@test.com' });

      expect(response.status).toBe(201);
      expect(response.body.message).toContain('If the email matches');

      const publishedResetEvent = eventSpy.mock.calls.find(
        (call) => call[0].eventName === 'communication.password_reset_requested',
      );
      expect(publishedResetEvent).toBeUndefined();

      eventSpy.mockRestore();
    });

    it('should complete reset password, revoke sessions, and login with new password', async () => {
      const eventSpy = jest.spyOn(eventBus, 'publish');

      // 1. Trigger forgot password
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email });

      const publishedResetEvent = eventSpy.mock.calls.find(
        (call) => call[0].eventName === 'communication.password_reset_requested',
      )?.[0] as any;
      const resetToken = publishedResetEvent.payload.resetToken;

      // 2. Mock a session/refresh token
      await prisma.refreshToken.create({
        data: {
          userId,
          token: `old-refresh-token-${Date.now()}`,
          tokenHash: `old-hash-${Date.now()}`,
          expiresAt: new Date(Date.now() + 100000),
          device: 'Desktop',
        },
      });

      // 3. Reset password
      const newPassword = 'NewPassword123!';
      const resetResponse = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: resetToken, password: newPassword });

      expect(resetResponse.status).toBe(201);
      expect(resetResponse.body.message).toBe('Password reset successfully');

      // Verify old sessions/refresh tokens are revoked
      const activeRefreshTokens = await prisma.refreshToken.findMany({
        where: { userId, isRevoked: false },
      });
      expect(activeRefreshTokens).toHaveLength(0);

      // Verify reset token is consumed
      const dbResetToken = await prisma.passwordResetToken.findFirst({
        where: { userId },
      });
      expect(dbResetToken?.isConsumed).toBe(true);

      // 4. Verify login succeeds with new password
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ identifier: email, password: newPassword });

      expect(loginResponse.status).toBe(201);
      expect(loginResponse.body.data).toHaveProperty('accessToken');

      eventSpy.mockRestore();
    });

    it('should fail reset password if token is already consumed', async () => {
      const eventSpy = jest.spyOn(eventBus, 'publish');

      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email });

      const publishedResetEvent = eventSpy.mock.calls.find(
        (call) => call[0].eventName === 'communication.password_reset_requested',
      )?.[0] as any;
      const resetToken = publishedResetEvent.payload.resetToken;

      // Reset once
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: resetToken, password: 'NewPassword123!' });

      // Reset twice
      const secondResetResponse = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: resetToken, password: 'AnotherPassword123!' });

      expect(secondResetResponse.status).toBe(400);
      expect(secondResetResponse.body.message).toContain('Invalid or expired');

      eventSpy.mockRestore();
    });
  });

  describe('OTP & Email Verification', () => {
    let email: string;
    let userId: string;

    beforeEach(async () => {
      email = `verify-${Date.now()}@test.com`;
      const user = await prisma.user.create({
        data: {
          fullName: 'Verify User',
          username: `verify-${Date.now()}`,
          email,
          phone: `phone-${Date.now()}`,
          passwordHash: 'dummy',
          role: 'STAFF',
        },
      });
      userId = user.id;
    });

    it('should generate, resend, and verify OTP for email verification', async () => {
      const eventSpy = jest.spyOn(eventBus, 'publish');

      // 1. Resend verification
      const resendRes = await request(app.getHttpServer())
        .post('/auth/resend-verification')
        .send({ email });

      expect(resendRes.status).toBe(201);

      // Find the email verification requested event to get OTP
      const verifyRequestedEvent = eventSpy.mock.calls.find(
        (call) => call[0].eventName === 'communication.email_verification_requested',
      )?.[0] as any;

      expect(verifyRequestedEvent).toBeDefined();
      const otp = verifyRequestedEvent.payload.rawOtp;
      expect(otp).toHaveLength(6);

      // 2. Verify email
      const verifyRes = await request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({ email, otp });

      expect(verifyRes.status).toBe(201);
      expect(verifyRes.body.success).toBe(true);

      // Check DB user updated
      const updatedUser = await prisma.user.findUnique({ where: { id: userId } });
      expect(updatedUser?.isEmailVerified).toBe(true);
      expect(updatedUser?.emailVerifiedAt).toBeDefined();

      eventSpy.mockRestore();
    });

    it('should respect OTP attempt limits and revoke OTP after 5 failed attempts', async () => {
      const eventSpy = jest.spyOn(eventBus, 'publish');

      await request(app.getHttpServer())
        .post('/auth/resend-verification')
        .send({ email });

      const verifyRequestedEvent = eventSpy.mock.calls.find(
        (call) => call[0].eventName === 'communication.email_verification_requested',
      )?.[0] as any;
      const correctOtp = verifyRequestedEvent.payload.rawOtp;

      // Verify with wrong OTP 5 times
      for (let i = 0; i < 5; i++) {
        const verifyRes = await request(app.getHttpServer())
          .post('/auth/verify-email')
          .send({ email, otp: '000000' });
        
        expect(verifyRes.status).toBe(400);
      }

      // 6th attempt or using correct OTP now should fail with lockout / token revoked
      const correctRes = await request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({ email, otp: correctOtp });

      expect(correctRes.status).toBe(403);
      expect(correctRes.body.message).toContain('attempts exceeded');

      eventSpy.mockRestore();
    });

    it('should enforce cooldown on resending OTP too quickly', async () => {
      // Send first time
      const res1 = await request(app.getHttpServer())
        .post('/auth/resend-verification')
        .send({ email });
      expect(res1.status).toBe(201);

      // Send second time immediately
      const res2 = await request(app.getHttpServer())
        .post('/auth/resend-verification')
        .send({ email });
      
      expect(res2.status).toBe(403);
      expect(res2.body.message).toContain('Please wait');
    });
  });
});
