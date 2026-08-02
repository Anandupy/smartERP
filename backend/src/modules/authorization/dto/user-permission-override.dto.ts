import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { OverrideType } from '@/generated/client';

export class SetUserPermissionOverrideDto {
  @ApiProperty({
    description: 'Target Permission UUID',
    example: '019183ab-1234-7111-a111-111111111111',
  })
  @IsUUID('7')
  permissionId!: string;

  @ApiProperty({
    description: 'Override type: GRANT or DENY',
    enum: OverrideType,
    example: OverrideType.GRANT,
  })
  @IsEnum(OverrideType)
  type!: OverrideType;

  @ApiPropertyOptional({
    description: 'Reason for override assignment',
    example: 'Granted temporary access for audit preparation',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
