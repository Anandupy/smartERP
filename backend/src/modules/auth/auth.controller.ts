import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  Get,
  Delete,
  Param,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login with email/username/phone' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const sessionInfo = {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      device: this.parseDevice(req.headers['user-agent']),
    };
    const data = await this.authService.login(dto, sessionInfo);
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
  async logout(
    @Body('refreshToken') token: string,
    @Query('allDevices') allDevices?: string,
  ) {
    if (token) {
      await this.authService.logout(token, allDevices === 'true');
    }
    return { message: 'Logged out successfully' };
  }

  @Get('sessions')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get active sessions for current user' })
  async getSessions(@Req() req: any) {
    const data = await this.authService.getSessions(req.user.id);
    return { data, message: 'Sessions retrieved successfully' };
  }

  @Delete('sessions/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a specific session' })
  async revokeSession(@Param('id') id: string, @Req() req: any) {
    await this.authService.revokeSession(req.user.id, id);
    return { message: 'Session revoked successfully' };
  }

  @Delete('sessions')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke all sessions' })
  async revokeAllSessions(@Req() req: any) {
    await this.authService.revokeAllSessions(req.user.id);
    return { message: 'All sessions revoked successfully' };
  }

  private parseDevice(userAgent?: string): string {
    if (!userAgent) return 'Unknown';
    if (/mobile/i.test(userAgent)) return 'Mobile';
    if (/tablet/i.test(userAgent)) return 'Tablet';
    if (/ipad/i.test(userAgent)) return 'Tablet';
    return 'Desktop';
  }
}
