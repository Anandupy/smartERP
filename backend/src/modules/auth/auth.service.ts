import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { UserService } from '@/modules/user/user.service';
import { PasswordService } from '@/common/services/password.service';
import { LoginDto } from './dto/login.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.userService.findByIdentifier(dto.identifier);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check account lock
    if (user.lockUntil && user.lockUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
      throw new ForbiddenException(`Account locked. Try again after ${minutesLeft} minutes`);
    }

    const isPasswordValid = await this.passwordService.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      await this.handleFailedLogin(user);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed attempts on success
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockUntil: null, lastLoginAt: new Date() },
    });

    return this.generateTokens(user.id, user.email, user.role);
  }

  async refreshToken(token: string) {
    const refreshToken = await this.prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!refreshToken || refreshToken.isRevoked || refreshToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    return this.generateTokens(refreshToken.user.id, refreshToken.user.email, refreshToken.user.role);
  }

  async logout(token: string) {
    await this.prisma.refreshToken.update({
      where: { token },
      data: { isRevoked: true },
    });
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };
    
    const accessToken = this.jwtService.sign(payload);
    
    const refreshTokenValue = uuidv4();
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7); // 7 days

    await this.prisma.refreshToken.create({
      data: {
        userId,
        token: refreshTokenValue,
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
