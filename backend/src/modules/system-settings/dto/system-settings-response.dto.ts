import { ApiProperty } from '@nestjs/swagger';
import { Environment } from '@/generated/client';

/**
 * The single global configuration record.
 *
 * A singleton: `POST /system-settings/init` succeeds once and is rejected
 * afterwards, so every read returns the same row.
 */
export class SystemSettingsDto {
  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5c20' })
  id!: string;

  @ApiProperty({ example: 'CampusFlow ERP' })
  productName!: string;

  @ApiProperty({ example: 'CAMPUSFLOW' })
  productCode!: string;

  @ApiProperty({ example: '1.0.0' })
  version!: string;

  @ApiProperty({ enum: Environment, example: Environment.PROD })
  environment!: Environment;

  @ApiProperty({
    description:
      'A coarse global switch, separate from the scoped maintenance rules.',
    example: false,
  })
  maintenanceMode!: boolean;

  @ApiProperty({ type: String, nullable: true, example: null })
  maintenanceMessage!: string | null;

  @ApiProperty({ example: 'Asia/Kolkata' })
  defaultTimezone!: string;

  @ApiProperty({ example: 'INR' })
  defaultCurrency!: string;

  @ApiProperty({ example: 'en-IN' })
  defaultLanguage!: string;

  @ApiProperty({ example: 'support@campusflow.example' })
  supportEmail!: string;

  @ApiProperty({ example: '+912212345670' })
  supportPhone!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ type: String, nullable: true })
  createdBy!: string | null;

  @ApiProperty({ type: String, nullable: true })
  updatedBy!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}
