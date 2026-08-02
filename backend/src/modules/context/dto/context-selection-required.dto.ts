import { ApiProperty } from '@nestjs/swagger';
import {
  AvailableOrganizationItem,
  AvailableBranchItem,
  AvailableAcademicYearItem,
} from '../interfaces/execution-context.interface';

export class ContextSelectionRequiredDto {
  @ApiProperty({ example: 409 })
  statusCode!: number;

  @ApiProperty({ example: 'CONTEXT_SELECTION_REQUIRED' })
  error!: string;

  @ApiProperty({ example: 'Execution context must be selected.' })
  message!: string;

  @ApiProperty({ type: [Object] })
  availableOrganizations!: AvailableOrganizationItem[];

  @ApiProperty({ type: [Object] })
  availableBranches!: AvailableBranchItem[];

  @ApiProperty({ type: [Object] })
  availableAcademicYears!: AvailableAcademicYearItem[];
}
