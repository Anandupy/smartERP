import { ApiProperty } from '@nestjs/swagger';
import {
  SetupAction,
  SetupResource,
  WorkspaceSetupStage,
} from '../workspace-setup.types';

export class SetupActionDto implements SetupAction {
  @ApiProperty({ example: 'CREATE_ORGANIZATION' })
  action!: string;

  @ApiProperty({ example: 'POST' })
  method!: string;

  @ApiProperty({ example: '/v1/organizations' })
  path!: string;

  @ApiProperty({ example: 'Create the first organization.' })
  description!: string;
}

export class WorkspaceSetupStatusDto {
  @ApiProperty({
    description: 'True until the workspace has been marked initialized.',
    example: true,
  })
  setupRequired!: boolean;

  @ApiProperty({
    description: 'The resource to create next, or FINALIZE / COMPLETED.',
    enum: ['ORGANIZATION', 'BRANCH', 'ACADEMIC_YEAR', 'FINALIZE', 'COMPLETED'],
    example: 'ORGANIZATION',
  })
  setupStage!: WorkspaceSetupStage;

  @ApiProperty({
    description: 'Resources that do not yet exist, in creation order.',
    example: ['ORGANIZATION', 'BRANCH', 'ACADEMIC_YEAR'],
    isArray: true,
  })
  missingResources!: SetupResource[];

  @ApiProperty({
    description: 'Resources that already exist.',
    example: [],
    isArray: true,
  })
  completedResources!: SetupResource[];

  @ApiProperty({
    description:
      'Requests permitted while setup is incomplete. Empty once complete.',
    type: [SetupActionDto],
  })
  allowedActions!: SetupActionDto[];

  @ApiProperty({
    type: String,
    description: 'When setup was completed. Null while setup is required.',
    nullable: true,
    example: null,
  })
  initializedAt!: string | null;
}
