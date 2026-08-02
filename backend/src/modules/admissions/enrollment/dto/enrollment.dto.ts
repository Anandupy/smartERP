import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEnrollmentDto {
  @ApiProperty({ description: 'Program UUID' })
  @IsString()
  @IsNotEmpty()
  programId!: string;

  @ApiProperty({ description: 'Academic unit UUID (e.g. class/section)' })
  @IsString()
  @IsNotEmpty()
  academicUnitId!: string;

  @ApiPropertyOptional({ description: 'Assigned student roll number' })
  @IsString()
  @IsOptional()
  rollNumber?: string;

  @ApiPropertyOptional({
    description: 'Current enrollment status',
    default: 'ACTIVE',
  })
  @IsString()
  @IsOptional()
  enrollmentStatus?: string;
}
