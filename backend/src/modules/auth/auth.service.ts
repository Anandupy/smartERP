import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { UserLoggedInEvent } from '@/common/events';
import { UserService } from '@/modules/user/user.service';
import { PasswordService } from '@/common/services/password.service';
import { LoginDto } from './dto/login.dto';
import { v7 as uuidv7 } from 'uuid';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
    private readonly configService: ConfigService,
    private readonly eventBus: EventBus,
  ) {}

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

    const refreshToken = await this.prisma.refreshToken.findFirst({
      where: {
        OR: [
          { tokenHash },
          { token }, // Fallback for old tokens
        ],
      },
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

    const refreshToken = await this.prisma.refreshToken.findFirst({
      where: {
        OR: [{ tokenHash }, { token }],
      },
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

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
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

    const refreshTokenValue = uuidv7();
    const tokenHash = this.hashToken(refreshTokenValue);
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7); // 7 days

    await this.prisma.refreshToken.create({
      data: {
        userId,
        token: refreshTokenValue,
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
