import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class RenderTemplatePreviewDto {
  @ApiProperty({ description: 'Variables payload to render into the template' })
  @IsObject()
  @IsNotEmpty()
  variables!: Record<string, any>;

  @ApiPropertyOptional({ description: 'Specific template ID to render' })
  @IsString()
  @IsOptional()
  templateId?: string;

  @ApiPropertyOptional({
    description: 'Template code to render (if templateId not provided)',
  })
  @IsString()
  @IsOptional()
  code?: string;
}
