import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min, Max } from 'class-validator';
import {
  CommunicationChannel,
  DeliveryStatus,
  ProviderType,
} from '@/generated/client';

export class QueryDeliveryLogDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 50;

  @ApiPropertyOptional({ enum: CommunicationChannel })
  @IsEnum(CommunicationChannel)
  @IsOptional()
  channel?: CommunicationChannel;

  @ApiPropertyOptional({ enum: DeliveryStatus })
  @IsEnum(DeliveryStatus)
  @IsOptional()
  status?: DeliveryStatus;

  @ApiPropertyOptional({ enum: ProviderType })
  @IsEnum(ProviderType)
  @IsOptional()
  provider?: ProviderType;

  @ApiPropertyOptional({ description: 'Filter by recipient' })
  @IsString()
  @IsOptional()
  recipient?: string;

  @ApiPropertyOptional({ description: 'Start date (ISO)' })
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (ISO)' })
  @IsString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Organization ID filter' })
  @IsString()
  @IsOptional()
  organizationId?: string;

  @ApiPropertyOptional({ description: 'Branch ID filter' })
  @IsString()
  @IsOptional()
  branchId?: string;
}
