import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateApplicantDto,
  UpdateApplicantDto,
} from '@/modules/admissions/applicant/dto/applicant.dto';
import {
  CreateGuardianDto,
  UpdateGuardianDto,
} from '@/modules/admissions/guardians/dto/guardian.dto';
import {
  AADHAAR_FORMAT_MESSAGE,
  normalizeGovernmentId,
} from '@/infrastructure/crypto/government-id';
import { GovernmentIdType } from '@/generated/client';

/**
 * The request boundary and the identity index must agree on what an Aadhaar
 * is. When they did not, a number starting with 0 or 1 passed the DTO, was
 * stored on the applicant, and was then silently dropped at submission —
 * the applicant's identity resolved without it and nobody was told.
 *
 * Synthetic values only: format-valid where they need to be, never issued.
 */
describe('Aadhaar at the request boundary', () => {
  const DTOS = [
    CreateApplicantDto,
    UpdateApplicantDto,
    CreateGuardianDto,
    UpdateGuardianDto,
  ];

  const aadhaarErrors = async (
    dto: (typeof DTOS)[number],
    aadhaarNo: string,
  ) => {
    const errors = await validate(plainToInstance(dto, { aadhaarNo }));
    return errors
      .filter((e) => e.property === 'aadhaarNo')
      .flatMap((e) => Object.values(e.constraints ?? {}));
  };

  const indexAccepts = (value: string) => {
    try {
      normalizeGovernmentId(GovernmentIdType.AADHAAR, value);
      return true;
    } catch {
      return false;
    }
  };

  it.each(DTOS)(
    '%p accepts exactly what the identity index accepts',
    async (dto) => {
      // Unseparated values only. The role records store the raw string, so the
      // DTO stays stricter than the index about spaces and hyphens.
      for (const value of [
        '234567890123',
        '999999999999',
        '012345678901',
        '123456789012',
        '23456789012',
        '2345678901234',
        '23456789012a',
        '',
      ]) {
        const accepted = (await aadhaarErrors(dto, value)).length === 0;
        expect({ value, accepted }).toEqual({
          value,
          accepted: indexAccepts(value),
        });
      }
    },
  );

  it.each(DTOS)(
    '%p explains the rule without echoing the value',
    async (dto) => {
      const value = '012345678901';
      const messages = await aadhaarErrors(dto, value);

      expect(messages).toEqual([AADHAAR_FORMAT_MESSAGE]);
      expect(messages.join(' ')).not.toContain(value);
    },
  );
});
