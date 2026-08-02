import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'Email, Username, or Mobile Number',
    example: 'admin@school.com',
  })
  @IsString()
  @IsNotEmpty()
  identifier!: string;

  @ApiProperty({
    description: 'User Account Password',
    example: 'Password123!',
  })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
