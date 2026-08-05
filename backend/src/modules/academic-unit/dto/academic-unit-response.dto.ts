import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AcademicUnitType } from '@/generated/client';

/**
 * A node of a branch's academic structure for one year — a class, a division,
 * a semester, a batch.
 *
 * The hierarchy is self-nesting through `parentId`, and `level` records the
 * depth so a flat list can be ordered without walking the tree.
 */
export class AcademicUnitDto {
  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a90' })
  id!: string;

  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6c' })
  branchId!: string;

  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a80' })
  programId!: string;

  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6d' })
  academicYearId!: string;

  @ApiProperty({
    description: 'Parent unit. Null at the root of the hierarchy.',
    nullable: true,
    example: null,
  })
  parentId!: string | null;

  @ApiProperty({ example: 'Class 11' })
  name!: string;

  @ApiProperty({ nullable: true, example: 'XI' })
  code!: string | null;

  @ApiProperty({
    enum: AcademicUnitType,
    example: AcademicUnitType.CLASS,
  })
  unitType!: AcademicUnitType;

  @ApiProperty({
    description: 'Depth in the hierarchy, 1 at the root.',
    example: 1,
  })
  level!: number;

  @ApiProperty({ nullable: true, example: 10 })
  displayOrder!: number | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: false })
  isDeleted!: boolean;

  @ApiProperty({
    description: 'Free-form attributes the branch attaches to the unit.',
    type: 'object',
    additionalProperties: true,
    nullable: true,
    example: null,
  })
  metadata!: Record<string, unknown> | null;

  @ApiProperty({ nullable: true })
  createdBy!: string | null;

  @ApiProperty({ nullable: true })
  updatedBy!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

/**
 * A unit with one level of hierarchy hydrated, as `GET /academic-units/:id`
 * returns it. Deleted children are excluded.
 */
export class AcademicUnitDetailDto extends AcademicUnitDto {
  @ApiProperty({
    description: 'Null at the root of the hierarchy.',
    type: () => AcademicUnitDto,
    nullable: true,
  })
  parent!: AcademicUnitDto | null;

  @ApiProperty({ type: () => [AcademicUnitDto] })
  children!: AcademicUnitDto[];
}

/**
 * A node of the academic tree.
 *
 * Every unit in the branch-year appears exactly once, nested under its parent.
 * `children` is present at every depth and empty at the leaves.
 */
export class AcademicUnitTreeNodeDto extends AcademicUnitDto {
  @ApiPropertyOptional({
    description: 'Child units, recursively. Empty at a leaf.',
    type: () => [AcademicUnitTreeNodeDto],
  })
  children!: AcademicUnitTreeNodeDto[];
}
