import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { ProgramLevel } from '@/generated/client';

export class CreateProgramDto {
  @IsUUID()
  @IsNotEmpty()
  branchId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(ProgramLevel)
  @IsOptional()
  level?: ProgramLevel;

  @IsString()
  @IsOptional()
  medium?: string;

  @IsString()
  @IsOptional()
  stream?: string;

  @IsUUID()
  @IsOptional()
  parentId?: string;
}
