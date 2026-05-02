import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '@/modules/auth/auth.service';
import { UserService } from '@/modules/user/user.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PasswordService } from '@/common/services/password.service';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;

  const mockUserService = {
    findByIdentifier: jest.fn(),
  };

  const mockPasswordService = {
    compare: jest.fn(),
  };

  const mockPrisma = {
    user: { update: jest.fn() },
    refreshToken: { create: jest.fn() },
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
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should throw UnauthorizedException for invalid credentials', async () => {
    mockUserService.findByIdentifier.mockResolvedValue(null);
    
    await expect(service.login({ identifier: 'test', password: 'password' }))
      .rejects.toThrow(UnauthorizedException);
  });
});
