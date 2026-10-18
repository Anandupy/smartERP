import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDefined,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ConfigScope } from '@/generated/client';

/**
 * Which tier a write targets. The id of that tier is **not** accepted from the
 * body: ORGANIZATION and BRANCH resolve to the organization and branch the
 * request is already scoped to, which the guard pipeline has validated.
 */
export class ConfigScopeQueryDto {
  @ApiProperty({ enum: ConfigScope })
  @IsEnum(ConfigScope)
  scopeType!: ConfigScope;
}

export class SetConfigValueDto extends ConfigScopeQueryDto {
  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'integer' }, { type: 'boolean' }],
    description:
      'The new value, typed per the key: a boolean, a whole number, or one of the enum values.',
    example: 'SIMPLE_ADMISSION',
  })
  @IsDefined()
  value!: unknown;

  @ApiPropertyOptional({
    description: 'Why the policy changed. Required for every admissions key.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ClearConfigValueDto extends ConfigScopeQueryDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ConfigValueDto {
  @ApiProperty() id!: string;
  @ApiProperty() definitionKey!: string;
  @ApiProperty({ enum: ConfigScope }) scopeType!: ConfigScope;
  @ApiProperty({ type: String, nullable: true }) scopeId!: string | null;
  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'integer' }, { type: 'boolean' }],
    description: 'Typed per the key.',
  })
  value!: unknown;
  @ApiProperty() version!: number;
  @ApiProperty({ type: String, format: 'date-time' }) effectiveFrom!: Date;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  effectiveTo!: Date | null;
  @ApiProperty({ type: String, nullable: true }) setBy!: string | null;
  @ApiProperty({ type: String, format: 'date-time' }) setAt!: Date;
  @ApiProperty({ type: String, nullable: true }) reason!: string | null;
}

export class ConfigClearedDto {
  @ApiProperty({
    description: 'False when no value was set at that scope to clear.',
  })
  cleared!: boolean;
}
