import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProgramLevel } from '@/generated/client';
import { BranchDto } from '@/modules/branch/dto/branch-response.dto';

/**
 * A course of study offered by a branch.
 *
 * Programs are self-nesting: `parentId` links a specialisation to the program
 * it belongs to, and a program with children cannot be deleted.
 */
export class ProgramDto {
  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a80' })
  id!: string;

  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6c' })
  branchId!: string;

  @ApiProperty({ example: 'Higher Secondary' })
  name!: string;

  @ApiProperty({
    enum: ProgramLevel,
    nullable: true,
    example: ProgramLevel.SCHOOL,
  })
  level!: ProgramLevel | null;

  @ApiProperty({ type: String, nullable: true, example: 'English' })
  medium!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Science' })
  stream!: string | null;

  @ApiProperty({
    type: String,
    description: 'Parent program, when this one is a specialisation.',
    nullable: true,
    example: null,
  })
  parentId!: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: false })
  isDeleted!: boolean;

  @ApiProperty({ type: String, nullable: true })
  createdBy!: string | null;

  @ApiProperty({ type: String, nullable: true })
  updatedBy!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

/** A program with its parent hydrated, as the list endpoint returns it. */
export class ProgramWithParentDto extends ProgramDto {
  @ApiProperty({
    description: 'Null for a top-level program.',
    type: () => ProgramDto,
    nullable: true,
  })
  parent!: ProgramDto | null;
}

/** A program with both its branch and its parent hydrated. */
export class ProgramDetailDto extends ProgramWithParentDto {
  @ApiProperty({ type: () => BranchDto })
  branch!: BranchDto;
}

/**
 * A node of the program hierarchy.
 *
 * Every program in the branch appears exactly once, nested under its parent.
 * `children` is present at every depth and empty at the leaves.
 */
export class ProgramTreeNodeDto extends ProgramDto {
  @ApiPropertyOptional({
    description: 'Sub-programs, recursively. Empty at a leaf.',
    type: () => [ProgramTreeNodeDto],
  })
  children!: ProgramTreeNodeDto[];
}
