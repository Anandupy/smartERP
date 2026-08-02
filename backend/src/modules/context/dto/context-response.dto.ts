import { ApiProperty } from '@nestjs/swagger';

export class ExecutionContextDto {
  @ApiProperty({
    example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6b',
    nullable: true,
  })
  organizationId!: string | null;

  @ApiProperty({
    example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6c',
    nullable: true,
  })
  branchId!: string | null;

  @ApiProperty({
    example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6d',
    nullable: true,
  })
  academicYearId!: string | null;

  @ApiProperty({ example: null, nullable: true })
  programId!: null;

  @ApiProperty({ example: null, nullable: true })
  departmentId!: null;

  @ApiProperty({ example: null, nullable: true })
  campusId!: null;
}
