import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  Get,
  Delete,
  Param,
  Req,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyAuthOtpDto } from './dto/verify-auth-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { Public } from '@/common/decorators/public.decorator';
import { AllowDuringSetup } from '@/common/decorators/allow-during-setup.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @AllowDuringSetup()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current authenticated user profile & context',
    description:
      'Also reports workspace bootstrap state via `setup`. When `setup.setupRequired` is true the client must run the setup flow; tenant context headers are not required until it completes.',
  })
  async getMe(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    const data = await this.authService.getMe(userId, req.context);
    return { data, message: 'Profile retrieved successfully' };
  }

  @Public()
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

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Body('refreshToken') token: string) {
    if (!token) throw new UnauthorizedException('Refresh token required');
    const data = await this.authService.refreshToken(token);
    return { data, message: 'Token refreshed' };
  }

  @Post('logout')
  @ApiBearerAuth()
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
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get active sessions for current user' })
  async getSessions(@Req() req: any) {
    const data = await this.authService.getSessions(req.user.id);
    return { data, message: 'Sessions retrieved successfully' };
  }

  @Delete('sessions/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a specific session' })
  async revokeSession(@Param('id') id: string, @Req() req: any) {
    await this.authService.revokeSession(req.user.id, id);
    return { message: 'Session revoked successfully' };
  }

  @Delete('sessions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke all sessions' })
  async revokeAllSessions(@Req() req: any) {
    await this.authService.revokeAllSessions(req.user.id);
    return { message: 'All sessions revoked successfully' };
  }

  @Public()
  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset link/OTP' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using secure token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Public()
  @Post('verify-email')
  @ApiOperation({ summary: 'Verify email address using OTP' })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.email, dto.otp);
  }

  @Public()
  @Post('resend-verification')
  @ApiOperation({ summary: 'Resend email verification OTP' })
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto.email);
  }

  @Public()
  @Post('send-otp')
  @ApiOperation({ summary: 'Generate and send OTP for specific purpose' })
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto.identifier, dto.purpose);
  }

  @Public()
  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify OTP code' })
  async verifyOtp(@Body() dto: VerifyAuthOtpDto) {
    return this.authService.verifyOtp(dto.identifier, dto.purpose, dto.otp);
  }

  @Public()
  @Post('resend-otp')
  @ApiOperation({ summary: 'Resend OTP' })
  async resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto.identifier, dto.purpose);
  }

  private parseDevice(userAgent?: string): string {
    if (!userAgent) return 'Unknown';
    if (/mobile/i.test(userAgent)) return 'Mobile';
    if (/tablet/i.test(userAgent)) return 'Tablet';
    if (/ipad/i.test(userAgent)) return 'Tablet';
    return 'Desktop';
  }
}
