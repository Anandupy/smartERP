import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import {
  UserLoggedInEvent,
  PasswordResetRequestedEvent,
  PasswordChangedEvent,
  EmailVerificationRequestedEvent,
  EmailVerifiedEvent,
  OtpResendRequestedEvent,
  OtpVerifiedEvent,
  OtpSentEvent,
} from '@/common/events';
import { UserService } from '@/modules/user/user.service';
import { PasswordService } from '@/common/services/password.service';
import { LoginDto } from './dto/login.dto';
import { MaintenanceService } from '@/modules/maintenance/maintenance.service';
import { OtpService } from '@/modules/communication/otp/otp.service';
import { OtpPurpose } from '@/generated/client';

import { AuthorizationService } from '@/modules/authorization/authorization.service';
import { ContextDiscoveryService } from '@/modules/context/services/context-discovery.service';
import { WorkspaceSetupService } from '@/modules/workspace/setup/workspace-setup.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
    private readonly configService: ConfigService,
    private readonly eventBus: EventBus,
    private readonly maintenanceService: MaintenanceService,
    private readonly otpService: OtpService,
    private readonly authorizationService: AuthorizationService,
    private readonly contextDiscoveryService: ContextDiscoveryService,
    private readonly workspaceSetupService: WorkspaceSetupService,
  ) {}

  async getMe(userId: string, currentContext?: any) {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { passwordHash, twoFactorSecret, ...sanitizedUser } = user as any;

    const { effectivePermissions } =
      await this.authorizationService.getUserEffectivePermissions(
        userId,
        user.role,
      );

    const [discovery, setup] = await Promise.all([
      this.contextDiscoveryService.discoverContexts(
        userId,
        user.role,
        user.organizationId,
        user.branchId,
        currentContext?.organizationId,
        currentContext?.branchId,
      ),
      // /auth/me is the client's first authenticated call, so it is where the
      // bootstrap state belongs: a fresh installation learns it must run setup
      // before it discovers that every other endpoint is blocked.
      this.workspaceSetupService.getStatus(),
    ]);

    const context = {
      organizationId:
        currentContext?.organizationId || user.organizationId || null,
      branchId: currentContext?.branchId || user.branchId || null,
      academicYearId: currentContext?.academicYearId || null,
    };

    return {
      user: sanitizedUser,
      role: user.role,
      permissions: effectivePermissions,
      context,
      setup,
      availableOrganizations: discovery.availableOrganizations,
      availableBranches: discovery.availableBranches,
      availableAcademicYears: discovery.availableAcademicYears,
    };
  }

  async login(
    dto: LoginDto,
    sessionInfo?: { ipAddress?: string; userAgent?: string; device?: string },
  ) {
    const user = await this.userService.findByIdentifier(dto.identifier);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check account lock
    if (user.lockUntil && user.lockUntil > new Date()) {
      const minutesLeft = Math.ceil(
        (user.lockUntil.getTime() - Date.now()) / 60000,
      );
      throw new ForbiddenException(
        `Account locked. Try again after ${minutesLeft} minutes`,
      );
    }

    const isPasswordValid = await this.passwordService.compare(
      dto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      await this.handleFailedLogin(user);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify maintenance status for this user
    await this.maintenanceService.checkMaintenance(
      {
        userId: user.id,
        role: user.role,
        organizationId: user.organizationId,
        branchId: user.branchId,
      },
      'POST',
      '/auth/login',
    );

    // Reset failed attempts on success
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockUntil: null,
        lastLoginAt: new Date(),
      },
    });

    await this.eventBus.publish(
      new UserLoggedInEvent({
        userId: user.id,
        username: user.username,
        loginAt: new Date(),
      }),
    );

    return this.generateTokens(user.id, user.email, user.role, sessionInfo);
  }

  async refreshToken(token: string) {
    const tokenHash = this.hashToken(token);

    const refreshToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !refreshToken ||
      refreshToken.isRevoked ||
      refreshToken.expiresAt < new Date()
    ) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Token Rotation: mark old token as revoked
    await this.prisma.refreshToken.update({
      where: { id: refreshToken.id },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });

    // Create new refresh token, maintaining session info
    return this.generateTokens(
      refreshToken.user.id,
      refreshToken.user.email,
      refreshToken.user.role,
      {
        ipAddress: refreshToken.ipAddress || undefined,
        userAgent: refreshToken.userAgent || undefined,
        device: refreshToken.device || undefined,
      },
    );
  }

  async logout(token: string, allDevices = false) {
    const tokenHash = this.hashToken(token);

    const refreshToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!refreshToken) return;

    if (allDevices) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: refreshToken.userId, isRevoked: false },
        data: { isRevoked: true, revokedAt: new Date() },
      });
    } else {
      await this.prisma.refreshToken.update({
        where: { id: refreshToken.id },
        data: { isRevoked: true, revokedAt: new Date() },
      });
    }
  }

  async getSessions(userId: string) {
    return this.prisma.refreshToken.findMany({
      where: { userId, isRevoked: false, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        device: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeSession(userId: string, sessionId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { id: sessionId, userId, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date() },
    });
  }

  async revokeAllSessions(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date() },
    });
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.userService.findByIdentifier(email);
    const genericMessage =
      'If the email matches an account in our system, a password reset link will be sent shortly.';

    if (!user) {
      return { message: genericMessage };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    await this.eventBus.publish(
      new PasswordResetRequestedEvent({
        userId: user.id,
        email: user.email,
        resetToken,
        userName: user.fullName,
        expiresInMinutes: 15,
      }),
    );

    return { message: genericMessage };
  }

  async resetPassword(dto: any): Promise<{ message: string }> {
    const { token, password } = dto;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const resetTokenRecord = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !resetTokenRecord ||
      resetTokenRecord.isConsumed ||
      resetTokenRecord.expiresAt < new Date()
    ) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const user = resetTokenRecord.user;
    const passwordHash = await this.passwordService.hash(password);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });

      await tx.passwordResetToken.update({
        where: { id: resetTokenRecord.id },
        data: {
          isConsumed: true,
          consumedAt: new Date(),
        },
      });

      await tx.refreshToken.updateMany({
        where: { userId: user.id, isRevoked: false },
        data: {
          isRevoked: true,
          revokedAt: new Date(),
        },
      });
    });

    await this.eventBus.publish(
      new PasswordChangedEvent({
        userId: user.id,
        email: user.email,
        userName: user.fullName,
      }),
    );

    return { message: 'Password reset successfully' };
  }

  async verifyEmail(
    email: string,
    otp: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.userService.findByIdentifier(email);
    if (!user) {
      throw new NotFoundException(`User not found with email ${email}`);
    }

    await this.otpService.verifyOtp({
      identifier: email,
      otp,
      purpose: OtpPurpose.EMAIL_VERIFY,
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });

    await this.eventBus.publish(
      new EmailVerifiedEvent({
        userId: user.id,
        email: user.email,
      }),
    );

    await this.eventBus.publish(
      new OtpVerifiedEvent({
        identifier: email,
        purpose: OtpPurpose.EMAIL_VERIFY,
        userId: user.id,
      }),
    );

    return { success: true, message: 'Email verified successfully' };
  }

  async resendVerification(email: string): Promise<{ message: string }> {
    const user = await this.userService.findByIdentifier(email);
    if (!user) {
      throw new NotFoundException(`User not found with email ${email}`);
    }

    const otpResult = await this.otpService.generateOtp({
      identifier: email,
      purpose: OtpPurpose.EMAIL_VERIFY,
      ttlMinutes: 10,
      resendCooldownSeconds: 60,
    });

    await this.eventBus.publish(
      new EmailVerificationRequestedEvent({
        userId: user.id,
        email: user.email,
        rawOtp: otpResult.rawOtp,
      }),
    );

    return { message: 'Verification email resent successfully' };
  }

  async sendOtp(
    identifier: string,
    purpose: OtpPurpose,
  ): Promise<{ message: string }> {
    const user = await this.userService.findByIdentifier(identifier);
    if (!user) {
      throw new NotFoundException(
        `User not found for identifier: ${identifier}`,
      );
    }

    const otpResult = await this.otpService.generateOtp({
      identifier,
      purpose,
      ttlMinutes: 10,
      resendCooldownSeconds: 60,
    });

    await this.eventBus.publish(
      new OtpSentEvent({
        identifier,
        purpose,
        rawOtp: otpResult.rawOtp,
        email: user.email,
        phone: user.phone,
        userId: user.id,
      }),
    );

    return { message: 'OTP sent successfully' };
  }

  async verifyOtp(
    identifier: string,
    purpose: OtpPurpose,
    otp: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.userService.findByIdentifier(identifier);
    const userId = user?.id;

    const verifyResult = await this.otpService.verifyOtp({
      identifier,
      otp,
      purpose,
    });

    await this.eventBus.publish(
      new OtpVerifiedEvent({
        identifier,
        purpose,
        userId,
      }),
    );

    return verifyResult;
  }

  async resendOtp(
    identifier: string,
    purpose: OtpPurpose,
  ): Promise<{ message: string }> {
    const user = await this.userService.findByIdentifier(identifier);
    if (!user) {
      throw new NotFoundException(
        `User not found for identifier: ${identifier}`,
      );
    }

    const otpResult = await this.otpService.generateOtp({
      identifier,
      purpose,
      ttlMinutes: 10,
      resendCooldownSeconds: 60,
    });

    await this.eventBus.publish(
      new OtpResendRequestedEvent({
        identifier,
        purpose,
        rawOtp: otpResult.rawOtp,
        email: user.email,
        phone: user.phone,
        userId: user.id,
      }),
    );

    return { message: 'OTP resent successfully' };
  }

  /**
   * Derives the stored form of a refresh token.
   *
   * SHA-256 rather than bcrypt: the input is 384 bits of CSPRNG output, so
   * there is no low-entropy secret to slow an attacker down against, and the
   * digest has to be indexable for lookup.
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async generateTokens(
    userId: string,
    email: string,
    role: string,
    sessionInfo?: { ipAddress?: string; userAgent?: string; device?: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true, branchId: true },
    });

    const payload = {
      sub: userId,
      email,
      role,
      organizationId: user?.organizationId,
      branchId: user?.branchId,
    };

    const accessToken = this.jwtService.sign(payload);

    // 384 bits from the CSPRNG. uuidv7 was unsuitable here: it embeds a
    // timestamp and carries only 74 random bits, so a refresh token was far
    // more guessable than its length suggested.
    const refreshTokenValue = crypto.randomBytes(48).toString('base64url');
    const tokenHash = this.hashToken(refreshTokenValue);
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7); // 7 days

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        ipAddress: sessionInfo?.ipAddress,
        userAgent: sessionInfo?.userAgent,
        device: sessionInfo?.device || 'Unknown',
        expiresAt: refreshTokenExpiry,
      },
    });

    return {
      accessToken,
      refreshToken: refreshTokenValue,
    };
  }

  private async handleFailedLogin(user: any) {
    const attempts = user.failedLoginAttempts + 1;
    const data: any = { failedLoginAttempts: attempts };

    if (attempts >= 5) {
      const lockUntil = new Date();
      lockUntil.setMinutes(lockUntil.getMinutes() + 10);
      data.lockUntil = lockUntil;
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data,
    });
  }
}
