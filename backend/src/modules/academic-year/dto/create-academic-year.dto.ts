import { IsString, IsNotEmpty, IsDateString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAcademicYearDto {
  @ApiProperty({ example: '2025-26' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: '2025-04-01' })
  @IsDateString()
  @IsNotEmpty()
  startDate!: string;

  @ApiProperty({ example: '2026-03-31' })
  @IsDateString()
  @IsNotEmpty()
  endDate!: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  branchId!: string;
}
