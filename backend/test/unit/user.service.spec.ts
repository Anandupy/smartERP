import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from '@/modules/user/user.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PasswordService } from '@/common/services/password.service';
import { ConflictException } from '@nestjs/common';

describe('UserService', () => {
  let service: UserService;
  let prisma: PrismaService;

  const mockPrisma = {
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const mockPasswordService = {
    hash: jest.fn().mockResolvedValue('hashed-password'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PasswordService, useValue: mockPasswordService },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should throw ConflictException if user already exists', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ email: 'test@test.com' });
    
    await expect(service.createUser({
      fullName: 'Test',
      username: 'test',
      email: 'test@test.com',
      phone: '123',
      password: 'password',
      role: 'STAFF' as any
    })).rejects.toThrow(ConflictException);
  });
});
