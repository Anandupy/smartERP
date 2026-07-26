import { IsNotEmpty, IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OtpPurpose } from '@/generated/client';

export class SendOtpDto {
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
}
