import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { MenuStatus } from '@/generated/client';

export class UpdateMenuStatusDto {
  @ApiProperty({
    example: 'ACTIVE',
    enum: MenuStatus,
    description: 'New menu status',
  })
  @IsEnum(MenuStatus)
  @IsNotEmpty()
  status!: MenuStatus;
}
