import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { OtpPurpose, OtpToken } from '@/generated/client';
import { GenerateOtpDto } from './dto/generate-otp.dto';
import { VerifyCommunicationOtpDto } from './dto/verify-communication-otp.dto';

export interface GenerateOtpResponse {
  rawOtp: string; // Returned ONLY to the caller service (or for messaging dispatch), NEVER stored raw
  otpTokenId: string;
  expiresAt: Date;
  resendAvailableAt: Date;
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async generateOtp(dto: GenerateOtpDto): Promise<GenerateOtpResponse> {
    const ttlMinutes = dto.ttlMinutes || 10;
    const cooldownSeconds = dto.resendCooldownSeconds || 60;
    const length = dto.length || 6;

    // Check for existing active token to enforce resend cooldown
    const existingActive = await this.prisma.otpToken.findFirst({
      where: {
        identifier: dto.identifier,
        purpose: dto.purpose,
        isUsed: false,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (
      existingActive &&
      existingActive.resendAvailableAt &&
      existingActive.resendAvailableAt > new Date()
    ) {
      const waitSeconds = Math.ceil(
        (existingActive.resendAvailableAt.getTime() - Date.now()) / 1000,
      );
      throw new ForbiddenException(
        `Please wait ${waitSeconds} seconds before requesting a new OTP for ${dto.purpose}`,
      );
    }

    // Revoke previous active tokens for this identifier & purpose
    if (existingActive) {
      await this.prisma.otpToken.updateMany({
        where: {
          identifier: dto.identifier,
          purpose: dto.purpose,
          isUsed: false,
          isRevoked: false,
        },
        data: { isRevoked: true, revokedAt: new Date() },
      });
    }

    // Generate secure numeric OTP
    const rawOtp = this.generateNumericOtp(length);
    const otpHash = this.hashOtp(rawOtp);

    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    const resendAvailableAt = new Date(Date.now() + cooldownSeconds * 1000);

    const token = await this.prisma.otpToken.create({
      data: {
        identifier: dto.identifier,
        otpHash,
        purpose: dto.purpose,
        expiresAt,
        resendAvailableAt,
        organizationId: dto.organizationId || null,
        branchId: dto.branchId || null,
      },
    });

    this.logger.log(
      `Generated OTP token [${token.id}] for [${dto.identifier}] Purpose: [${dto.purpose}]`,
    );

    return {
      rawOtp,
      otpTokenId: token.id,
      expiresAt,
      resendAvailableAt,
    };
  }

  async verifyOtp(
    dto: VerifyCommunicationOtpDto,
  ): Promise<{ success: boolean; message: string }> {
    const hash = this.hashOtp(dto.otp);

    const token = await this.prisma.otpToken.findFirst({
      where: {
        identifier: dto.identifier,
        purpose: dto.purpose,
        isUsed: false,
        isRevoked: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!token) {
      throw new NotFoundException(`No active OTP found for ${dto.identifier}`);
    }

    if (token.expiresAt < new Date()) {
      await this.prisma.otpToken.update({
        where: { id: token.id },
        data: { isRevoked: true, revokedAt: new Date() },
      });
      throw new BadRequestException(
        'OTP has expired. Please request a new one.',
      );
    }

    if (token.attempts >= token.maxAttempts) {
      await this.prisma.otpToken.update({
        where: { id: token.id },
        data: { isRevoked: true, revokedAt: new Date() },
      });
      throw new ForbiddenException(
        'Maximum OTP verification attempts exceeded. Token revoked.',
      );
    }

    if (token.otpHash !== hash) {
      const updatedAttempts = token.attempts + 1;
      await this.prisma.otpToken.update({
        where: { id: token.id },
        data: { attempts: updatedAttempts },
      });

      const remaining = token.maxAttempts - updatedAttempts;
      throw new BadRequestException(
        `Invalid OTP. ${remaining} attempt(s) remaining before lockout.`,
      );
    }

    // Success - mark used and revoke any duplicates
    await this.prisma.otpToken.update({
      where: { id: token.id },
      data: {
        isUsed: true,
        usedAt: new Date(),
      },
    });

    this.logger.log(
      `OTP successfully verified for [${dto.identifier}] Purpose: [${dto.purpose}]`,
    );

    return {
      success: true,
      message: 'OTP verified successfully',
    };
  }

  async revokeOtp(identifier: string, purpose: OtpPurpose): Promise<void> {
    await this.prisma.otpToken.updateMany({
      where: {
        identifier,
        purpose,
        isUsed: false,
        isRevoked: false,
      },
      data: { isRevoked: true, revokedAt: new Date() },
    });
  }

  private generateNumericOtp(length: number): string {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += crypto.randomInt(0, 10).toString();
    }
    return result;
  }

  private hashOtp(rawOtp: string): string {
    return crypto.createHash('sha256').update(rawOtp).digest('hex');
  }
}
