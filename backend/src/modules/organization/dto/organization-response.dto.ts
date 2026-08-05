import { ApiProperty } from '@nestjs/swagger';
import { OrganizationStatus } from '@/generated/client';

/**
 * A tenant, the root of the hierarchy every other record hangs from.
 *
 * Returned in full — the service performs no projection, so every column of
 * the model reaches the client.
 */
export class OrganizationDto {
  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6b' })
  id!: string;

  @ApiProperty({ example: 'Northfield Education Trust' })
  name!: string;

  @ApiProperty({ description: 'Unique tenant code.', example: 'net' })
  code!: string;

  @ApiProperty({ nullable: true, example: 'https://cdn.example.edu/logo.png' })
  logoUrl!: string | null;

  @ApiProperty({ example: 'office@northfield.edu' })
  contactEmail!: string;

  @ApiProperty({ example: '+912212345678' })
  contactPhone!: string;

  @ApiProperty({ nullable: true, example: '14 Ring Road' })
  addressLine1!: string | null;

  @ApiProperty({ nullable: true, example: 'Sector 7' })
  addressLine2!: string | null;

  @ApiProperty({ nullable: true, example: 'Pune' })
  city!: string | null;

  @ApiProperty({ nullable: true, example: 'Maharashtra' })
  state!: string | null;

  @ApiProperty({ nullable: true, example: 'India' })
  country!: string | null;

  @ApiProperty({ nullable: true, example: '411001' })
  pincode!: string | null;

  @ApiProperty({
    description: 'When the tenant’s licence lapses.',
    type: String,
    format: 'date-time',
  })
  masterExpiryDate!: Date;

  @ApiProperty({
    description: 'A soft-deleted organization is set to INACTIVE.',
    enum: OrganizationStatus,
    example: OrganizationStatus.ACTIVE,
  })
  status!: OrganizationStatus;

  @ApiProperty({ nullable: true, example: 'Asia/Kolkata' })
  timezone!: string | null;

  @ApiProperty({ nullable: true, example: 'INR' })
  currency!: string | null;

  @ApiProperty({ nullable: true })
  createdBy!: string | null;

  @ApiProperty({ nullable: true })
  updatedBy!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}
