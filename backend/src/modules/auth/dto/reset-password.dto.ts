import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'The secure password reset token received via email',
    example: 'a4f7b2c9...',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    description: 'The new password to set for the account',
    example: 'NewPassword123!',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;
}
