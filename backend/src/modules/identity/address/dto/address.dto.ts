import {
  IsEnum,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AddressType } from '@/generated/client';

export { AddressType };

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Attach (or replace, for the same `addressType`) an address for a Person.
 *
 * There is no `validFrom`/`validTo` here — the service sets `validFrom` to
 * now and closes any existing open link of the same type. Backdating a
 * window is not exposed; it has no legitimate use this API needs to serve.
 */
export class AttachAddressDto {
  @ApiProperty({ example: '221B, MG Road' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  line1!: string;

  @ApiPropertyOptional({ example: 'Near City Hospital' })
  @Transform(trim)
  @IsString()
  @IsOptional()
  @MaxLength(200)
  line2?: string;

  @ApiPropertyOptional({ example: 'Opposite the water tank' })
  @Transform(trim)
  @IsString()
  @IsOptional()
  @MaxLength(100)
  landmark?: string;

  @ApiProperty({ example: 'Pune' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city!: string;

  @ApiPropertyOptional({ example: 'Pune' })
  @Transform(trim)
  @IsString()
  @IsOptional()
  @MaxLength(100)
  district?: string;

  @ApiProperty({ example: 'Maharashtra' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  state!: string;

  @ApiPropertyOptional({ example: 'IN', default: 'IN' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @IsOptional()
  @Matches(/^[A-Z]{2}$/, {
    message: 'countryCode must be a 2-letter ISO code',
  })
  countryCode?: string;

  @ApiProperty({ example: '411001' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(12)
  pincode!: string;

  @ApiPropertyOptional({ example: 18.5204 })
  @IsNumber()
  @IsLatitude()
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional({ example: 73.8567 })
  @IsNumber()
  @IsLongitude()
  @IsOptional()
  longitude?: number;

  @ApiProperty({ enum: AddressType, example: AddressType.CURRENT })
  @IsIn(Object.values(AddressType))
  addressType!: AddressType;

  @ApiPropertyOptional({
    description:
      'Free-text reason a human wrote. The system cannot tell a corrected ' +
      'typo from a genuine relocation after the fact — this is what does.',
    example: 'Family relocated within the same city',
  })
  @Transform(trim)
  @IsString()
  @IsOptional()
  @MaxLength(500)
  changeReason?: string;
}

export class ResolveAddressQueryDto {
  @ApiProperty({ enum: AddressType, example: AddressType.CURRENT })
  @IsEnum(AddressType)
  type!: AddressType;

  @ApiPropertyOptional({
    description: 'ISO date-time to resolve as of. Defaults to now.',
  })
  @IsString()
  @IsOptional()
  asOf?: string;
}
