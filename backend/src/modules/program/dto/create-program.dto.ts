import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProgramLevel } from '@/generated/client';

export class CreateProgramDto {
  @ApiProperty({ description: 'Target Branch UUID' })
  @IsUUID()
  @IsNotEmpty()
  branchId!: string;

  @ApiProperty({
    description: 'Program Name',
    example: 'Higher Secondary Science',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    description: 'Program Level',
    enum: ProgramLevel,
    example: ProgramLevel.SCHOOL,
  })
  @IsEnum(ProgramLevel)
  @IsOptional()
  level?: ProgramLevel;

  @ApiPropertyOptional({
    description: 'Medium of Instruction',
    example: 'English',
  })
  @IsString()
  @IsOptional()
  medium?: string;

  @ApiPropertyOptional({
    description: 'Academic Stream',
    example: 'Science (PCM)',
  })
  @IsString()
  @IsOptional()
  stream?: string;

  @ApiPropertyOptional({ description: 'Parent Program UUID if nested' })
  @IsUUID()
  @IsOptional()
  parentId?: string;
}
