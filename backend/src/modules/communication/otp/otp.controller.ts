import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { OtpService } from './otp.service';
import { GenerateOtpDto } from './dto/generate-otp.dto';
import { VerifyCommunicationOtpDto } from './dto/verify-communication-otp.dto';

@ApiTags('Communication OTP')
@Controller('communication/otp')
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
  async verify(@Body() dto: VerifyCommunicationOtpDto) {
    return this.otpService.verifyOtp(dto);
  }
}
