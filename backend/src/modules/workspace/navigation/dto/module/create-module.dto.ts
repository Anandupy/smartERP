import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Matches,
} from 'class-validator';

export class CreateModuleDto {
  @ApiProperty({
    example: 'HOSTEL',
    description: 'Unique module code identifier',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9_]+$/, {
    message:
      'code must contain only uppercase letters, numbers, and underscores',
  })
  code!: string;

  @ApiProperty({
    example: 'Hostel Management',
    description: 'User-friendly module display name',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    example: 'Student hostel accommodation & room allocation management',
    description: 'Detailed description of the module',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    example: 'home',
    description: 'Icon name or identifier for UI rendering',
  })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiPropertyOptional({
    example: 10,
    description: 'Display order sorting rank',
    default: 0,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  displayOrder?: number;
}
