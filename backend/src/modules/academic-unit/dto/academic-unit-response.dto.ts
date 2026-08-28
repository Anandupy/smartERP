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
    type: String,
    description: 'Parent unit. Null at the root of the hierarchy.',
    nullable: true,
    example: null,
  })
  parentId!: string | null;

  @ApiProperty({ example: 'Class 11' })
  name!: string;

  @ApiProperty({ type: String, nullable: true, example: 'XI' })
  code!: string | null;

  @ApiProperty({
    enum: AcademicUnitType,
    example: AcademicUnitType.CLASS,
  })
  unitType!: AcademicUnitType;

  @ApiProperty({
    description:
      'Depth in the hierarchy, 0 at the root. Server-computed on create and recalculated across the subtree on move — never accepted from a client.',
    example: 0,
  })
  level!: number;

  @ApiProperty({
    description:
      'Sort order among siblings. Null sorts last, after every sibling that has one.',
    type: Number,
    nullable: true,
    example: 10,
  })
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

  @ApiProperty({ type: String, nullable: true })
  createdBy!: string | null;

  @ApiProperty({ type: String, nullable: true })
  updatedBy!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

/**
 * A unit decorated with the two facts a placement picker needs, computed at
 * read time from the current hierarchy and never stored: a name change or a
 * re-parent is reflected on the next read with nothing to backfill.
 */
export class AcademicUnitPlacementDto extends AcademicUnitDto {
  @ApiProperty({
    description:
      'The full path from the root, so a client never has to guess that "Division A" sits under "Grade 1". Recomputed on every read — never a stored, staleness-prone copy.',
    example: 'Grade 1 → Division A',
  })
  displayPath!: string;

  @ApiProperty({
    description:
      'Whether this unit is a valid Enrollment placement target — it has no active child units. A unit with children ("Grade 1") is a structural node, not a place a learner sits, and is refused if sent as an Enrollment or admission academicUnitId.',
    example: true,
  })
  isPlacementTarget!: boolean;
}

/** One ancestor in a ancestor-to-root walk. Always structural: `isPlacementTarget` is `false` by construction, since it has at least the unit the walk started from as a descendant. */
export class AcademicUnitAncestorDto {
  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6f' })
  id!: string;

  @ApiProperty({ example: 'Grade 1' })
  name!: string;

  @ApiProperty({ enum: AcademicUnitType, example: AcademicUnitType.CLASS })
  unitType!: AcademicUnitType;

  @ApiProperty({ example: 0 })
  level!: number;

  @ApiProperty({ example: 'Grade 1' })
  displayPath!: string;

  @ApiProperty({ example: false })
  isPlacementTarget!: false;
}

/**
 * A unit with one level of hierarchy hydrated, as `GET /academic-units/:id`
 * returns it. Deleted children are excluded.
 */
export class AcademicUnitDetailDto extends AcademicUnitPlacementDto {
  @ApiProperty({
    description: 'Null at the root of the hierarchy.',
    type: () => AcademicUnitDto,
    nullable: true,
  })
  parent!: AcademicUnitDto | null;

  @ApiProperty({ type: () => [AcademicUnitDto] })
  children!: AcademicUnitDto[];

  @ApiProperty({
    description:
      "Root-first ancestor chain, excluding this unit itself. Empty at the root. `displayPath` above is this chain plus this unit's own name, already joined.",
    type: () => [AcademicUnitAncestorDto],
  })
  ancestors!: AcademicUnitAncestorDto[];
}

/**
 * A node of the academic tree.
 *
 * Every unit in the branch-year appears exactly once, nested under its parent.
 * `children` is present at every depth and empty at the leaves.
 */
export class AcademicUnitTreeNodeDto extends AcademicUnitPlacementDto {
  @ApiPropertyOptional({
    description: 'Child units, recursively. Empty at a leaf.',
    type: () => [AcademicUnitTreeNodeDto],
  })
  children!: AcademicUnitTreeNodeDto[];
}
