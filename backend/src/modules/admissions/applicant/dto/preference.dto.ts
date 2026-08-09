import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProgramPreferenceEntryDto {
  @ApiProperty({ description: 'A programme in the applicant own branch.' })
  @IsUUID()
  programId!: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  remarks?: string;
}

/**
 * The complete ordered list.
 *
 * Positions are derived from array order rather than supplied, so a client
 * cannot send two entries claiming position 2 and the server never has to
 * reconcile a ranking it was handed. Replacing the whole list also means a
 * reorder is one atomic write instead of a sequence during which two rows
 * transiently share a place.
 */
export class SetProgramPreferencesDto {
  @ApiProperty({
    type: [ProgramPreferenceEntryDto],
    description: 'In order of preference. The first entry is the first choice.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ProgramPreferenceEntryDto)
  preferences!: ProgramPreferenceEntryDto[];
}
