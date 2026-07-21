import { SetMetadata } from '@nestjs/common';

export const REQUIRE_ACADEMIC_YEAR_KEY = 'requireAcademicYear';

export interface AcademicYearOptions {
  /**
   * If true, missing Academic Year header will not throw an error if no active year is found.
   */
  optional?: boolean;
  /**
   * If true, allows falling back to the selected academic year for the branch if x-academic-year-id header is missing.
   */
  allowFallback?: boolean;
}

export const RequireAcademicYear = (options: AcademicYearOptions = {}) =>
  SetMetadata(REQUIRE_ACADEMIC_YEAR_KEY, { optional: false, allowFallback: true, ...options });
