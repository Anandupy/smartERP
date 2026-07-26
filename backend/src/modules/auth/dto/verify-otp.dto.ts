import { IsNotEmpty, IsString, IsEnum, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OtpPurpose } from '@/generated/client';

export class VerifyOtpDto {
  @ApiProperty({
    description:
      'Email, Username, or Mobile Number associated with the account',
    example: 'user@school.com',
  })
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @ApiProperty({
    description: 'The purpose of the OTP',
    enum: OtpPurpose,
    example: OtpPurpose.LOGIN,
  })
  @IsEnum(OtpPurpose)
  @IsNotEmpty()
  purpose: OtpPurpose;

  @ApiProperty({
    description: 'The OTP code to verify',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  otp: string;
}
