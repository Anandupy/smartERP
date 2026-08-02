import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'The email address of the user account',
    example: 'user@school.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}
