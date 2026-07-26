import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AuditQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Page limit', default: 50, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @ApiPropertyOptional({
    description: 'Sort by field',
    enum: ['timestamp', 'severity', 'module', 'executionTime'],
    default: 'timestamp',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'timestamp';

  @ApiPropertyOptional({
    description: 'Sort order direction',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ description: 'Keyword search term' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by User ID' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Filter by Role' })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ description: 'Filter by Module' })
  @IsOptional()
  @IsString()
  module?: string;

  @ApiPropertyOptional({ description: 'Filter by Aggregate Type (Entity)' })
  @IsOptional()
  @IsString()
  aggregateType?: string;

  @ApiPropertyOptional({ description: 'Filter by Aggregate ID (Entity ID)' })
  @IsOptional()
  @IsString()
  aggregateId?: string;

  @ApiPropertyOptional({ description: 'Filter by Action' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ description: 'Filter by Severity' })
  @IsOptional()
  @IsString()
  severity?: string;

  @ApiPropertyOptional({ description: 'Filter by Status' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by Organization ID' })
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional({ description: 'Filter by Branch ID' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Filter by Academic Year ID' })
  @IsOptional()
  @IsString()
  academicYearId?: string;

  @ApiPropertyOptional({ description: 'Filter by Request ID' })
  @IsOptional()
  @IsString()
  requestId?: string;

  @ApiPropertyOptional({ description: 'Filter by Trace ID' })
  @IsOptional()
  @IsString()
  traceId?: string;

  @ApiPropertyOptional({ description: 'Filter by Correlation ID' })
  @IsOptional()
  @IsString()
  correlationId?: string;

  @ApiPropertyOptional({ description: 'Filter by HTTP Method' })
  @IsOptional()
  @IsString()
  httpMethod?: string;

  @ApiPropertyOptional({ description: 'Filter by Route' })
  @IsOptional()
  @IsString()
  route?: string;

  @ApiPropertyOptional({ description: 'Filter by start date (ISO date string)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Filter by end date (ISO date string)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Filter by minimum execution time in ms' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  minExecutionTime?: number;

  @ApiPropertyOptional({ description: 'Filter by maximum execution time in ms' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  maxExecutionTime?: number;

  @ApiPropertyOptional({
    description: 'Whether to include large columns (metadata and changes)',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeDetails?: boolean = false;
}
