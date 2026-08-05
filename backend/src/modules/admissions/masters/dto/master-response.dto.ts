import { ApiProperty } from '@nestjs/swagger';

/**
 * A reference-data row: religion, caste, category, gender, blood group,
 * language, disability, relation type, quota or admission source.
 *
 * All ten share this shape and are served by `BaseMasterService`, so one
 * schema describes them all rather than ten identical copies.
 *
 * Scope is expressed by `organizationId` and `branchId`: both null is a
 * system-wide default, an organization with no branch is tenant-wide, and both
 * set is specific to one branch. A list returns whichever of the three apply,
 * so a branch sees its own rows alongside the defaults it inherits.
 */
export class AdmissionMasterDto {
  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5aa0' })
  id!: string;

  @ApiProperty({
    type: String,
    description: 'Null for a system-wide default.',
    nullable: true,
    example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6b',
  })
  organizationId!: string | null;

  @ApiProperty({
    type: String,
    description: 'Null when the row applies to the whole organization.',
    nullable: true,
    example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6c',
  })
  branchId!: string | null;

  @ApiProperty({
    description: 'Unique within the scope, case-insensitively.',
    example: 'GEN',
  })
  code!: string;

  @ApiProperty({
    description: 'Unique within the scope, case-insensitively.',
    example: 'General',
  })
  name!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Applicants with no reservation.',
  })
  description!: string | null;

  @ApiProperty({ description: 'Sort order within the list.', example: 0 })
  displayOrder!: number;

  @ApiProperty({
    description: 'Inactive rows are hidden unless `includeInactive` is set.',
    example: true,
  })
  isActive!: boolean;

  @ApiProperty({
    description: 'Free-form attributes attached to the row.',
    type: 'object',
    additionalProperties: true,
    nullable: true,
    example: null,
  })
  metadata!: Record<string, unknown> | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({
    description: 'Set when the row is soft-deleted. Null while it is live.',
    type: String,
    format: 'date-time',
    nullable: true,
    example: null,
  })
  deletedAt!: Date | null;
}
