import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class QueryPermissionsDto {
  @ApiPropertyOptional({
    description: 'Filter permissions by Category UUID',
    example: '019183ab-1234-7111-a111-111111111111',
  })
  @IsOptional()
  @IsUUID('7')
  categoryId?: string;
}
