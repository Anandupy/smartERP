import { Controller, Post, Body, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from '@/modules/auth/auth.service';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Demonstration endpoint for login. You will replace the body with DTOs.
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: any) {
    // Placeholder logic for database user verification
    const dummyUserId = '12345-uuid'; 
    const tokens = await this.authService.generateTokens(dummyUserId, body.email);
    return {
      message: 'Login successful',
      data: tokens,
    };
  }

  // Endpoint to refresh token using the 'jwt-refresh' guard.
  @Post('refresh')
  @UseGuards(AuthGuard('jwt-refresh'))
  @HttpCode(HttpStatus.OK)
  async refreshTokens(@Req() req: Request) {
    const user = req.user as any; 
    // user.refreshToken is appended by RefreshTokenStrategy
    const tokens = await this.authService.refreshTokens(user.sub, user.refreshToken);
    return {
      message: 'Tokens refreshed successfully',
      data: tokens,
    };
  }
}
