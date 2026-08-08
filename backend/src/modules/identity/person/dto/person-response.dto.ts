import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GovernmentIdType } from '@/generated/client';
import { MatchConfidence } from '../person.types';

/**
 * What an identity read returns.
 *
 * Never `aadhaarEnc`, never `govtIdHash`, never `phoneHash`, never `keyVersion`.
 * Those are infrastructure: the ciphertext is useless without the key, the blind
 * index is a stable per-tenant identifier for a value the caller is not
 * entitled to, and the key version tells an attacker which key to look for.
 *
 * The only representation of a government identifier that leaves the process is
 * its masked form.
 */
export class PersonIdentityDto {
  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6b' })
  id!: string;

  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a00' })
  organizationId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  dob!: Date;

  @ApiPropertyOptional({
    enum: GovernmentIdType,
    nullable: true,
    description: 'Present only when an identifier has been bound.',
  })
  governmentIdType!: GovernmentIdType | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Masked. The full value is never returned by this API.',
    example: 'XXXX XXXX 1012',
  })
  governmentIdMasked!: string | null;

  @ApiProperty({
    description: 'True when the identifier has been crypto-erased.',
    example: false,
  })
  governmentIdErased!: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Set when this identity was merged into another. Follow it rather than caching this id.',
  })
  mergedIntoPersonId!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;
}

export class PersonCandidateDto {
  @ApiProperty()
  personId!: string;

  @ApiProperty({
    enum: MatchConfidence,
    description:
      'MEDIUM and LOW are suggestions for a human. HIGH never appears here — a deterministic match is returned by resolve() instead.',
  })
  confidence!: MatchConfidence;

  @ApiProperty({
    type: [String],
    description: 'Which signals agreed. Never the values themselves.',
    example: ['phone+dob'],
  })
  matchedOn!: string[];
}

export class AttachGovernmentIdResultDto {
  @ApiProperty()
  personId!: string;

  @ApiProperty({
    description: 'Masked confirmation of what was stored.',
    example: 'XXXX XXXX 1012',
  })
  governmentIdMasked!: string;
}

export class MatchDecisionResultDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  personAId!: string;

  @ApiProperty()
  personBId!: string;

  @ApiProperty({ example: 'DISTINCT' })
  decision!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  decidedAt!: Date;
}
