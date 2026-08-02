import { HttpStatus } from '@nestjs/common';
import { Prisma } from '@/generated/client';

export interface TranslatedError {
  status: HttpStatus;
  message: string;
  code: string;
}

export class PrismaErrorTranslator {
  static translate(
    error: Prisma.PrismaClientKnownRequestError,
  ): TranslatedError {
    const code = error.code;
    const meta = error.meta || {};

    switch (code) {
      case 'P2002': {
        // Unique constraint failed
        const targets = (meta.target as string[]) || [];
        let message = 'Record already exists.';

        if (targets.includes('admissionFormNo')) {
          message = 'Admission Form Number already exists.';
        } else if (targets.includes('applicationNo')) {
          message = 'Application Number already exists.';
        } else if (
          targets.includes('primaryMobile') ||
          targets.includes('mobilePrimary')
        ) {
          message = 'A profile with this primary mobile number already exists.';
        } else if (targets.includes('aadhaarNo')) {
          message = 'A profile with this Aadhaar number already exists.';
        } else if (targets.includes('email')) {
          message = 'A profile with this email address already exists.';
        } else if (targets.includes('code')) {
          message =
            'A master record with this code already exists in this scope.';
        } else if (targets.includes('name')) {
          message =
            'A master record with this name already exists in this scope.';
        } else if (
          targets.includes('applicantId_guardianId') ||
          (targets.includes('applicantId') && targets.includes('guardianId'))
        ) {
          message = 'This guardian is already mapped to the applicant.';
        } else if (targets.includes('applicantId')) {
          message = 'An enrollment record already exists for this applicant.';
        } else if (
          targets.includes('branchId_purpose') ||
          (targets.includes('branchId') && targets.includes('purpose'))
        ) {
          message =
            'A number sequence configuration for this purpose already exists in this branch.';
        } else if (targets.includes('configId_academicYearId')) {
          message =
            'A number sequence counter already exists for this config and academic year.';
        } else if (targets.length > 0) {
          message = `A record with duplicate values for field(s) (${targets.join(', ')}) already exists.`;
        }

        return {
          status: HttpStatus.CONFLICT,
          message,
          code: 'UNIQUE_CONSTRAINT_FAILED',
        };
      }

      case 'P2003': {
        // Foreign key constraint failed
        const fieldName = (meta.field_name as string) || '';
        let message = 'Selected related reference record was not found.';

        if (fieldName.includes('genderId')) {
          message = 'Selected Gender does not exist.';
        } else if (fieldName.includes('religionId')) {
          message = 'Selected Religion does not exist.';
        } else if (fieldName.includes('casteId')) {
          message = 'Selected Caste does not exist.';
        } else if (fieldName.includes('categoryId')) {
          message = 'Selected Category does not exist.';
        } else if (fieldName.includes('motherTongueId')) {
          message = 'Selected Mother Tongue language does not exist.';
        } else if (fieldName.includes('bloodGroupId')) {
          message = 'Selected Blood Group does not exist.';
        } else if (fieldName.includes('disabilityTypeId')) {
          message = 'Selected Disability type does not exist.';
        } else if (fieldName.includes('admissionSourceId')) {
          message = 'Selected Admission Source does not exist.';
        } else if (fieldName.includes('quotaId')) {
          message = 'Selected Quota does not exist.';
        } else if (fieldName.includes('relationTypeId')) {
          message = 'Selected Relation Type does not exist.';
        } else if (fieldName.includes('academicUnitId')) {
          message = 'Selected Academic Unit does not exist.';
        } else if (fieldName.includes('programId')) {
          message = 'Selected Program does not exist.';
        } else if (fieldName.includes('applicantId')) {
          message = 'Selected Applicant reference does not exist.';
        } else if (fieldName.includes('guardianId')) {
          message = 'Selected Guardian reference does not exist.';
        } else if (fieldName.includes('branchId')) {
          message = 'Selected Branch does not exist.';
        } else if (fieldName.includes('organizationId')) {
          message = 'Selected Organization does not exist.';
        } else if (fieldName.includes('academicYearId')) {
          message = 'Selected Academic Year does not exist.';
        } else if (fieldName.includes('configId')) {
          message = 'Selected Number Configuration does not exist.';
        }

        return {
          status: HttpStatus.BAD_REQUEST,
          message,
          code: 'REFERENCE_NOT_FOUND',
        };
      }

      case 'P2025': {
        // Record to update/delete not found
        const cause = (meta.cause as string) || '';
        let message = 'Record not found or already deleted.';
        if (cause.toLowerCase().includes('relation')) {
          message =
            'Unable to perform operation because a required relationship record was not found.';
        }

        return {
          status: HttpStatus.NOT_FOUND,
          message,
          code: 'RECORD_NOT_FOUND',
        };
      }

      case 'P2014': {
        // Violation of required relation
        return {
          status: HttpStatus.BAD_REQUEST,
          message:
            'The operation violates a required relationship constraint with another record.',
          code: 'RELATION_VIOLATION',
        };
      }

      case 'P2016': {
        // Query interpretation error
        return {
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          message:
            'Unable to process request due to relational database inconsistency.',
          code: 'RELATION_INCONSISTENCY',
        };
      }

      case 'P2021': {
        // Table does not exist
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Database schema mismatch. Please contact administrator.',
          code: 'DATABASE_TABLE_MISSING',
        };
      }

      case 'P2022': {
        // Column does not exist
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Database columns mismatch. Please contact administrator.',
          code: 'DATABASE_COLUMN_MISSING',
        };
      }

      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message:
            'An unexpected database error occurred. Please contact administrator.',
          code: `PRISMA_ERROR_${code}`,
        };
    }
  }
}
