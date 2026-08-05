import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class MoveAcademicUnitDto {
  @ApiPropertyOptional({
    type: String,
    description: 'New Parent ID (null to move to root)',
  })
  @IsOptional()
  @IsString()
  parentId?: string | null;
}
