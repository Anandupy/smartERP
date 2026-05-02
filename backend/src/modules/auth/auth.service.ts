import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async generateTokens(userId: string, email?: string, role: Role = Role.SUPER_ADMIN) {
    const payload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('env.jwtSecret'),
        expiresIn: this.configService.get<string>('env.jwtExpiresIn') as any,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('env.jwtRefreshSecret'),
        expiresIn: this.configService.get<string>('env.jwtRefreshExpiresIn') as any,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  // A basic placeholder for verifying refresh tokens and issuing new ones.
  // In a real app, you should check against the hashed refresh token stored in the DB.
  async refreshTokens(userId: string, refreshToken: string) {
    // 1. Validate the user exists.
    // 2. Validate the passed refreshToken matches the one in DB.
    
    // Then generate new pair
    return this.generateTokens(userId);
  }
}
