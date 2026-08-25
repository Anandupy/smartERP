import { GovernmentIdType, StudentCreationMode } from '@/generated/client';

export { StudentCreationMode };

/**
 * Everything needed to mint a learner identity.
 *
 * Deliberately **not** a DTO bound to any route. There is no `POST /students`:
 * a Student has no meaning on its own, and letting staff manufacture one would
 * produce identities with no application, no admission and no placement behind
 * them. In Phase 5 `admit()` builds this from a seat-confirmed applicant; until
 * then only fixtures and the migration importer construct it.
 */
export interface CreateStudentInput {
  organizationId: string;
  branchId: string;
  personId: string;

  firstName: string;
  middleName?: string | null;
  lastName: string;
  dob: Date;
  genderId: string;

  religionId?: string | null;
  casteId?: string | null;
  categoryId?: string | null;
  motherTongueId?: string | null;
  bloodGroupId?: string | null;

  disabilityStatus?: boolean;
  disabilityTypeId?: string | null;
  disabilityNotes?: string | null;

  primaryMobile?: string | null;
  primaryEmail?: string | null;

  apaarId?: string | null;
  abcId?: string | null;
  penNo?: string | null;
  saralId?: string | null;
  udiseStudentId?: string | null;

  photoDocumentId?: string | null;

  createdVia: StudentCreationMode;
  /** Required unless `createdVia` is `MIGRATION`; a CHECK enforces it. */
  sourceApplicantId?: string | null;

  /**
   * The academic year this student is first admitted in.
   *
   * Not a Student field — Student holds no academic context, ever (see the
   * model's own doc) — and not persisted here either. Its only use is
   * numbering context: **if** an organization has configured `STUDENT_CODE`
   * to render a `{year}`, that year means the academic year of first
   * admission, a permanent historical fact, never the counter's reset year
   * (`STUDENT_CODE` never resets). Omit it and a year-bearing format fails
   * loudly at allocation rather than rendering blank; omit it and a
   * year-free format (the default) is unaffected.
   */
  admissionAcademicYearId?: string | null;

  createdBy?: string | null;
}

/**
 * The fields an operator may correct.
 *
 * A closed list rather than `Partial<Student>`: an update DTO that mirrors the
 * table will, sooner or later, accept `studentCode` or `organizationId` because
 * somebody added a field and the DTO followed. Immutability is enforced by what
 * is absent here, not by remembering to strip keys.
 */
export interface CorrectStudentDemographicsInput {
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
  dob?: Date;
  genderId?: string;

  religionId?: string | null;
  casteId?: string | null;
  categoryId?: string | null;
  motherTongueId?: string | null;
  bloodGroupId?: string | null;

  disabilityStatus?: boolean;
  disabilityTypeId?: string | null;
  disabilityNotes?: string | null;

  primaryMobile?: string | null;
  primaryEmail?: string | null;

  apaarId?: string | null;
  abcId?: string | null;
  penNo?: string | null;
  saralId?: string | null;
  udiseStudentId?: string | null;

  photoDocumentId?: string | null;
}

/** How a search term is being interpreted, so the caller can rank and explain. */
export type StudentSearchMatch =
  | 'studentCode'
  | 'studentCodePrefix'
  | 'mobile'
  | 'name'
  | 'dob';

export interface StudentSearchParams {
  /** Free text: a code, part of a name, or a phone number. */
  q?: string;
  /** Exact date of birth, combined with `q` when both are given. */
  dob?: Date;
  status?: string[];
  /** Include statuses other than ACTIVE. Archived students stay searchable. */
  includeInactive?: boolean;
  /**
   * Widen past the caller's branch. Requires `student.view.organization`; the
   * controller decides, the service is told.
   */
  organizationWide?: boolean;
  page?: number;
  limit?: number;
}

export const STUDENT_SEARCH_DEFAULT_LIMIT = 20;
export const STUDENT_SEARCH_MAX_LIMIT = 100;

/**
 * Government identifiers are reachable only through Person.
 *
 * Re-exported so a caller composing a student profile has one obvious place to
 * look and does not reach for a `Student.aadhaar` that will never exist.
 */
export { GovernmentIdType };
