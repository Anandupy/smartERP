import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { OtpPurpose } from '@/generated/client';

export class VerifyCommunicationOtpDto {
  @ApiProperty({
    description: 'Recipient identifier (email, phone, or userId)',
    example: 'user@example.com',
  })
  @IsString()
  @IsNotEmpty()
  identifier!: string;

  @ApiProperty({ enum: OtpPurpose, example: OtpPurpose.PASSWORD_RESET })
  @IsEnum(OtpPurpose)
  purpose!: OtpPurpose;

  @ApiProperty({
    description: 'Raw OTP value provided by client',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  otp!: string;
}
