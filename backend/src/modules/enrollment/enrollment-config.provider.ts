import { Injectable } from '@nestjs/common';

/**
 * How a roll number is decided.
 *
 * §50 Q7 is still open, so the three candidate policies are named and the
 * default is the one that assumes nothing: an institution that has not chosen
 * gets manual assignment rather than a number invented on its behalf.
 */
export enum RollNumberPolicy {
  /** A clerk types it. */
  MANUAL = 'MANUAL',
  /** Next free position in the class, assigned as students arrive. */
  SEQUENTIAL_ON_ADMISSION = 'SEQUENTIAL_ON_ADMISSION',
  /** Regenerated alphabetically once the class list settles. */
  ALPHABETICAL_ON_LOCK = 'ALPHABETICAL_ON_LOCK',
}

export interface EnrollmentPolicyScope {
  organizationId: string;
  branchId?: string | null;
}

/**
 * Enrollment policy that genuinely varies between institutions.
 *
 * The same shape as `AdmissionConfigProvider`, and for the same reason: the
 * Configuration Engine (F2) is not built, and scattering `process.env` reads or
 * adding settings columns to Branch would both have to be unpicked when it
 * lands. Every policy read goes through this interface with the architectural
 * default behind it.
 *
 * ## The class-list lock
 *
 * There is **no `classListLocked` column anywhere in the schema**, and this
 * phase deliberately does not invent one — a second lock flag competing with
 * `AcademicYear.isLocked` is exactly the conflicting model §54 warns about.
 * Until F2 provides a per-class-list lock, the class list is locked when its
 * academic year is: a year closed for results is not a year whose registers are
 * still being reshuffled. That is a coarser rule than the architecture's
 * eventual one, never a weaker one, so no write that should be refused is
 * allowed through.
 *
 * The missing dependency is recorded in the Phase 4 exit report rather than
 * papered over here.
 */
@Injectable()
export class EnrollmentConfigProvider {
  /**
   * Who assigns roll numbers, and when.
   *
   * Manual by default. A number the system chose is a number nobody can explain
   * to the parent who asks why their child is Roll 34.
   */
  rollNumberPolicy(
    _scope: EnrollmentPolicyScope,
    _asOf: Date = new Date(),
  ): RollNumberPolicy {
    return RollNumberPolicy.MANUAL;
  }

  /**
   * Whether the class register may still be reshuffled.
   *
   * Takes the year's lock state from the caller, which read it under a lock
   * inside the transaction. Passing it in rather than querying again is what
   * stops this becoming a second, unsynchronised read of the same fact.
   */
  classListLocked(
    _scope: EnrollmentPolicyScope,
    academicYearLocked: boolean,
    _academicUnitId?: string,
  ): boolean {
    return academicYearLocked;
  }
}
