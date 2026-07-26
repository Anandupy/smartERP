import { Test, TestingModule } from '@nestjs/testing';
import { OtpService } from './otp.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { OtpPurpose } from '@/generated/client';

describe('OtpService', () => {
  let service: OtpService;
  let prismaService: any;
  let eventBus: any;

  beforeEach(async () => {
    prismaService = {
      otpToken: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        { provide: PrismaService, useValue: prismaService },
        { provide: EventBus, useValue: eventBus },
      ],
    }).compile();

    service = module.get<OtpService>(OtpService);
  });

  it('should generate an OTP and store only hashed value', async () => {
    prismaService.otpToken.findFirst.mockResolvedValue(null);
    prismaService.otpToken.create.mockImplementation(({ data }: any) => ({
      id: 'token-123',
      ...data,
    }));

    const result = await service.generateOtp({
      identifier: 'user@example.com',
      purpose: OtpPurpose.PASSWORD_RESET,
      length: 6,
    });

    expect(result.rawOtp).toBeDefined();
    expect(result.rawOtp.length).toBe(6);
    expect(result.otpTokenId).toBe('token-123');

    // Verify hash stored, NOT raw OTP
    const createCall = prismaService.otpToken.create.mock.calls[0][0];
    expect(createCall.data.otpHash).toBeDefined();
    expect(createCall.data.otpHash).not.toEqual(result.rawOtp);
  });

  it('should verify correct OTP', async () => {
    const rawOtp = '123456';
    const hash = (service as any).hashOtp(rawOtp);

    prismaService.otpToken.findFirst.mockResolvedValue({
      id: 'token-123',
      identifier: 'user@example.com',
      purpose: OtpPurpose.PASSWORD_RESET,
      otpHash: hash,
      attempts: 0,
      maxAttempts: 5,
      expiresAt: new Date(Date.now() + 60000),
      isUsed: false,
      isRevoked: false,
    });

    prismaService.otpToken.update.mockResolvedValue({
      id: 'token-123',
      isUsed: true,
    });

    const response = await service.verifyOtp({
      identifier: 'user@example.com',
      purpose: OtpPurpose.PASSWORD_RESET,
      otp: rawOtp,
    });

    expect(response.success).toBe(true);
    expect(prismaService.otpToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'token-123' },
        data: expect.objectContaining({ isUsed: true }),
      }),
    );
  });
});
