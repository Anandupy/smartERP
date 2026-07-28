import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty } from 'class-validator';

export class UpdateModuleStatusDto {
  @ApiProperty({
    example: true,
    description: 'Active status of the module',
  })
  @IsBoolean()
  @IsNotEmpty()
  isActive!: boolean;
}
