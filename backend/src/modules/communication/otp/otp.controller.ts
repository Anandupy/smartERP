import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { OtpService } from './otp.service';
import { GenerateOtpDto } from './dto/generate-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@ApiTags('Communication OTP')
@Controller('v1/communication/otp')
export class OtpController {
  constructor(private readonly otpService: OtpService) {}

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate OTP for specified purpose' })
  async generate(@Body() dto: GenerateOtpDto) {
    const res = await this.otpService.generateOtp(dto);
    // Mask raw OTP in controller response wrapper for production security safety
    return {
      otpTokenId: res.otpTokenId,
      expiresAt: res.expiresAt,
      resendAvailableAt: res.resendAvailableAt,
      message: 'OTP generated and dispatched',
    };
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify provided OTP token' })
  async verify(@Body() dto: VerifyOtpDto) {
    return this.otpService.verifyOtp(dto);
  }
}
