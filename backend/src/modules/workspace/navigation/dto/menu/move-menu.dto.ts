import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsInt, Min } from 'class-validator';

export class MoveMenuDto {
  @ApiPropertyOptional({
    type: String,
    example: '019fa017-...',
    description:
      'New parent menu UUID identifier (null to promote to root level)',
  })
  @IsUUID('7')
  @IsOptional()
  targetParentId?: string | null;

  @ApiPropertyOptional({
    example: '019fa016-...',
    description: 'New parent module UUID identifier',
  })
  @IsUUID('7')
  @IsOptional()
  targetModuleId?: string;

  @ApiPropertyOptional({
    example: 2,
    description: 'New display order rank',
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  displayOrder?: number;
}
