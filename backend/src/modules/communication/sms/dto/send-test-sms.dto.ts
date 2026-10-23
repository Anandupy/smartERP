import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendTestSmsDto {
  @ApiProperty({
    example: '+919820145892',
    description: 'Recipient 10-digit mobile number or with +91',
  })
  @IsNotEmpty()
  @IsString()
  to!: string;

  @ApiProperty({
    example: 'Test SMS from Shree Siddhi Vinayagar ERP',
    description: 'Message body to send',
  })
  @IsNotEmpty()
  @IsString()
  message!: string;
}
