import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login with email/username/phone' })
  async login(@Body() dto: LoginDto) {
    const data = await this.authService.login(dto);
    return { data, message: 'Login successful' };
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Body('refreshToken') token: string) {
    if (!token) throw new UnauthorizedException('Refresh token required');
    const data = await this.authService.refreshToken(token);
    return { data, message: 'Token refreshed' };
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  async logout(@Body('refreshToken') token: string) {
    if (token) await this.authService.logout(token);
    return { message: 'Logged out successfully' };
  }
}
