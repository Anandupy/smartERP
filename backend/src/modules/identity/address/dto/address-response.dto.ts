import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AddressType, AddressVerificationStatus } from '@/generated/client';

/**
 * A resolved address for display. Raw address text is included here —
 * that is the point of the endpoint — but never in an event or audit
 * payload; see `common/events/address.events.ts`.
 */
export class PersonAddressDto {
  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5aa0' })
  id!: string;

  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5aa1' })
  personId!: string;

  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5aa2' })
  addressId!: string;

  @ApiProperty({ enum: AddressType })
  addressType!: AddressType;

  @ApiProperty({ example: '221B, MG Road' })
  line1!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  line2!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  landmark!: string | null;

  @ApiProperty({ example: 'Pune' })
  city!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  district!: string | null;

  @ApiProperty({ example: 'Maharashtra' })
  state!: string;

  @ApiProperty({ example: 'IN' })
  countryCode!: string;

  @ApiProperty({ example: '411001' })
  pincode!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  validFrom!: Date;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Null while this is the currently open link.',
  })
  validTo!: Date | null;

  @ApiProperty({ enum: AddressVerificationStatus })
  verificationStatus!: AddressVerificationStatus;

  @ApiPropertyOptional({ type: String, nullable: true })
  changeReason!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;
}
