import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  ValidateNested,
  IsUUID,
  IsInt,
  Min,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReorderMenuItemDto {
  @ApiProperty({
    example: '019fa018-...',
    description: 'Menu UUID identifier',
  })
  @IsUUID('7')
  @IsNotEmpty()
  id!: string;

  @ApiProperty({
    example: 1,
    description: 'New display order rank',
  })
  @IsInt()
  @Min(0)
  @IsNotEmpty()
  displayOrder!: number;
}

export class ReorderMenusDto {
  @ApiProperty({
    type: [ReorderMenuItemDto],
    description: 'Array of menu items with updated display orders',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderMenuItemDto)
  items!: ReorderMenuItemDto[];
}
