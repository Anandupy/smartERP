import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailDto {
  @ApiProperty({
    description: 'The email address to verify',
    example: 'user@school.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'The OTP code sent to the email',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  otp: string;
}
