import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceSetupService } from '@/modules/workspace/setup/workspace-setup.service';
import { AuthService } from '@/modules/auth/auth.service';
import { UserService } from '@/modules/user/user.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PasswordService } from '@/common/services/password.service';
import { ConfigService } from '@nestjs/config';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { OtpService } from '@/modules/communication/otp/otp.service';
import { MaintenanceService } from '@/modules/maintenance/maintenance.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OtpPurpose } from '@/generated/client';
import * as crypto from 'crypto';
import { AuthorizationService } from '@/modules/authorization/authorization.service';
import { ContextDiscoveryService } from '@/modules/context/services/context-discovery.service';

describe('AuthService Recovery & Verification', () => {
  let service: AuthService;
  let prisma: any;
  let eventBus: any;
  let otpService: any;
  let userService: any;
  let passwordService: any;

  beforeEach(async () => {
    prisma = {
      passwordResetToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      user: {
        update: jest.fn(),
      },
      refreshToken: {
        updateMany: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    otpService = {
      generateOtp: jest.fn(),
      verifyOtp: jest.fn(),
    };

    userService = {
      findByIdentifier: jest.fn(),
    };

    passwordService = {
      hash: jest.fn().mockResolvedValue('new-password-hash'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: UserService, useValue: userService },
        { provide: JwtService, useValue: {} },
        { provide: PasswordService, useValue: passwordService },
        { provide: ConfigService, useValue: {} },
        { provide: EventBus, useValue: eventBus },
        { provide: MaintenanceService, useValue: {} },
        { provide: OtpService, useValue: otpService },
        {
          provide: AuthorizationService,
          useValue: { getUserEffectivePermissions: jest.fn() },
        },
        {
          provide: ContextDiscoveryService,
          useValue: { discoverContexts: jest.fn() },
        },
        {
          provide: WorkspaceSetupService,
          useValue: { getStatus: jest.fn(), isInitialized: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('forgotPassword', () => {
    it('should return generic success message and emit event even if user is not found', async () => {
      userService.findByIdentifier.mockResolvedValue(null);
      const res = await service.forgotPassword('nonexistent@test.com');
      expect(res.message).toContain('If the email matches');
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('should generate, hash, store token and emit event if user is found', async () => {
      const user = {
        id: 'user-123',
        email: 'user@test.com',
        fullName: 'John Doe',
      };
      userService.findByIdentifier.mockResolvedValue(user);
      prisma.passwordResetToken.create.mockResolvedValue({});

      const res = await service.forgotPassword('user@test.com');
      expect(res.message).toContain('If the email matches');
      expect(prisma.passwordResetToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-123',
            tokenHash: expect.any(String),
          }),
        }),
      );
      expect(eventBus.publish).toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should throw BadRequestException if token not found or consumed or expired', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(null);
      await expect(
        service.resetPassword({
          token: 'invalid',
          password: 'newPassword123!',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reset password, consume token, and revoke user sessions', async () => {
      const user = {
        id: 'user-123',
        email: 'user@test.com',
        fullName: 'John Doe',
      };
      const tokenRecord = {
        id: 'token-id',
        userId: 'user-123',
        isConsumed: false,
        expiresAt: new Date(Date.now() + 10000),
        user,
      };
      prisma.passwordResetToken.findUnique.mockResolvedValue(tokenRecord);

      const res = await service.resetPassword({
        token: 'valid-token',
        password: 'newPassword123!',
      });
      expect(res.message).toBe('Password reset successfully');
      expect(passwordService.hash).toHaveBeenCalledWith('newPassword123!');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-123' },
          data: { passwordHash: 'new-password-hash' },
        }),
      );
      expect(prisma.passwordResetToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'token-id' },
          data: expect.objectContaining({ isConsumed: true }),
        }),
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-123', isRevoked: false },
          data: expect.objectContaining({ isRevoked: true }),
        }),
      );
      expect(eventBus.publish).toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    it('should verify email and update status in user table', async () => {
      const user = { id: 'user-123', email: 'user@test.com' };
      userService.findByIdentifier.mockResolvedValue(user);
      otpService.verifyOtp.mockResolvedValue({ success: true });

      const res = await service.verifyEmail('user@test.com', '123456');
      expect(res.success).toBe(true);
      expect(otpService.verifyOtp).toHaveBeenCalledWith({
        identifier: 'user@test.com',
        otp: '123456',
        purpose: OtpPurpose.EMAIL_VERIFY,
      });
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-123' },
          data: { isEmailVerified: true, emailVerifiedAt: expect.any(Date) },
        }),
      );
      expect(eventBus.publish).toHaveBeenCalledTimes(2); // EmailVerifiedEvent & OtpVerifiedEvent
    });
  });
});
