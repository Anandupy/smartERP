import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResendVerificationDto {
  @ApiProperty({
    description: 'The email address of the account to resend verification to',
    example: 'user@school.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}
