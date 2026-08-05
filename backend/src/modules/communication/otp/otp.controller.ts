import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { OtpService } from './otp.service';
import { GenerateOtpDto } from './dto/generate-otp.dto';
import { VerifyCommunicationOtpDto } from './dto/verify-communication-otp.dto';
import {
  ApiOkEnvelope,
  ApiPublicErrors,
} from '@/common/http/api-envelope-response.decorator';
import {
  OtpGeneratedDto,
  OtpVerifiedDto,
} from '../dto/communication-response.dto';

@ApiTags('Communication OTP')
@Controller('communication/otp')
export class OtpController {
  constructor(private readonly otpService: OtpService) {}

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate OTP for specified purpose',
    description:
      'The code itself is dispatched to the recipient and never returned.',
  })
  @ApiOkEnvelope(OtpGeneratedDto, {
    message: 'OTP generated and dispatched',
  })
  @ApiPublicErrors(429)
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
  @ApiOkEnvelope(OtpVerifiedDto, {
    message: 'OTP verified successfully',
  })
  @ApiPublicErrors(429)
  async verify(@Body() dto: VerifyCommunicationOtpDto) {
    return this.otpService.verifyOtp(dto);
  }
}
