import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '@/modules/auth/auth.service';
import { UserService } from '@/modules/user/user.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PasswordService } from '@/common/services/password.service';
import { ConfigService } from '@nestjs/config';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { UnauthorizedException } from '@nestjs/common';
import { MaintenanceService } from '@/modules/maintenance/maintenance.service';
import { OtpService } from '@/modules/communication/otp/otp.service';

describe('AuthService', () => {
  let service: AuthService;

  const mockEventBus = {
    publish: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn(),
  };

  const mockUserService = {
    findByIdentifier: jest.fn(),
    findById: jest.fn(),
  };

  const mockPasswordService = {
    compare: jest.fn(),
  };

  const mockMaintenanceService = {
    checkMaintenance: jest.fn().mockResolvedValue(undefined),
  };

  const mockPrisma = {
    user: { update: jest.fn(), findUnique: jest.fn() },
    refreshToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: mockUserService },
        { provide: PasswordService, useValue: mockPasswordService },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: { sign: () => 'token' } },
        { provide: ConfigService, useValue: { get: () => 'secret' } },
        { provide: EventBus, useValue: mockEventBus },
        { provide: MaintenanceService, useValue: mockMaintenanceService },
        { provide: OtpService, useValue: {} },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should throw UnauthorizedException for invalid credentials', async () => {
    mockUserService.findByIdentifier.mockResolvedValue(null);

    await expect(
      service.login({ identifier: 'test', password: 'password' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should login and create a hashed refresh token with session info', async () => {
    const user = {
      id: 'user-1',
      email: 'test@test.com',
      role: 'STAFF',
      passwordHash: 'hash',
      failedLoginAttempts: 0,
    };
    mockUserService.findByIdentifier.mockResolvedValue(user);
    mockPasswordService.compare.mockResolvedValue(true);
    mockPrisma.user.update.mockResolvedValue(user);
    mockPrisma.refreshToken.create.mockResolvedValue({ id: 'rt-1' });

    const sessionInfo = {
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
      device: 'Desktop',
    };
    const result = await service.login(
      { identifier: 'test@test.com', password: 'password' },
      sessionInfo,
    );

    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
    expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          tokenHash: expect.any(String),
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
        }),
      }),
    );
  });

  it('should refresh token and rotate (revoke old, create new)', async () => {
    const oldToken = 'old-token';
    const user = { id: 'user-1', email: 'test@test.com', role: 'STAFF' };
    const refreshTokenRecord = {
      id: 'rt-1',
      userId: 'user-1',
      isRevoked: false,
      expiresAt: new Date(Date.now() + 10000),
      user,
      ipAddress: '1.1.1.1',
    };

    mockPrisma.refreshToken.findFirst.mockResolvedValue(refreshTokenRecord);
    mockPrisma.refreshToken.update.mockResolvedValue({
      ...refreshTokenRecord,
      isRevoked: true,
    });
    mockPrisma.refreshToken.create.mockResolvedValue({ id: 'rt-2' });

    const result = await service.refreshToken(oldToken);

    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
    expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rt-1' },
        data: { isRevoked: true, revokedAt: expect.any(Date) },
      }),
    );
    expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ipAddress: '1.1.1.1',
        }),
      }),
    );
  });

  it('should revoke all sessions', async () => {
    await service.revokeAllSessions('user-1');
    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', isRevoked: false },
        data: { isRevoked: true, revokedAt: expect.any(Date) },
      }),
    );
  });
});
