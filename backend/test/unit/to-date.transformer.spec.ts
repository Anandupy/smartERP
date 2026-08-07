import 'reflect-metadata';
import {
  ValidationPipe,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { toDate } from '@/common/transformers/to-date.transformer';
import { CreateOrganizationDto } from '@/modules/organization/dto/create-organization.dto';

describe('toDate', () => {
  it('pins a calendar date to UTC midnight', () => {
    expect(toDate('2027-08-07')).toEqual(new Date('2027-08-07T00:00:00.000Z'));
  });

  it('keeps the instant of a full ISO timestamp', () => {
    expect(toDate('2027-08-07T10:30:00.000Z')).toEqual(
      new Date('2027-08-07T10:30:00.000Z'),
    );
  });

  it('passes a Date through untouched', () => {
    const date = new Date('2027-08-07T00:00:00.000Z');
    expect(toDate(date)).toBe(date);
  });

  it.each([
    'not-a-date',
    '07/08/2027',
    '2027-02-31', // rolls over to March if parsed blindly
    '',
    null,
    undefined,
  ])('leaves %p for the validator to reject', (value) => {
    expect(toDate(value)).toBe(value);
  });
});

describe('CreateOrganizationDto.masterExpiryDate', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const metadata: ArgumentMetadata = {
    type: 'body',
    metatype: CreateOrganizationDto,
    data: '',
  };

  const body = (masterExpiryDate: unknown) => ({
    name: 'Horizon Education Trust',
    code: 'horizon-trust',
    contactEmail: 'admin@horizon.edu',
    contactPhone: '9876543210',
    masterExpiryDate,
  });

  it('reaches the service as a Date when the client sends a calendar date', async () => {
    const dto = (await pipe.transform(
      body('2027-08-07'),
      metadata,
    )) as CreateOrganizationDto;

    expect(dto.masterExpiryDate).toBeInstanceOf(Date);
    expect(dto.masterExpiryDate.toISOString()).toBe('2027-08-07T00:00:00.000Z');
  });

  it('still accepts a full ISO timestamp', async () => {
    const dto = (await pipe.transform(
      body('2027-08-07T10:30:00.000Z'),
      metadata,
    )) as CreateOrganizationDto;

    expect(dto.masterExpiryDate.toISOString()).toBe('2027-08-07T10:30:00.000Z');
  });

  it('rejects a malformed date instead of forwarding it to Prisma', async () => {
    expect.assertions(2);

    try {
      await pipe.transform(body('not-a-date'), metadata);
    } catch (error) {
      const response = (error as BadRequestException).getResponse() as {
        statusCode: number;
        message: string[];
      };
      expect(response.statusCode).toBe(400);
      expect(response.message).toContain(
        'masterExpiryDate must be an ISO 8601 date (YYYY-MM-DD or a full timestamp)',
      );
    }
  });
});
