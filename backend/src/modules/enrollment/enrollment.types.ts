import {
  AdmissionExitReason,
  EnrollmentKind,
  EnrollmentOriginType,
  EnrollmentStatus,
} from '@/generated/client';

/**
 * The subsets each operation may name, spelled as literal unions.
 *
 * Prisma generates its enums as `const` objects plus a derived type, so
 * `EnrollmentStatus.ACTIVE` is a value and not usable in type position. Writing
 * the members out keeps the narrowing — a caller still cannot ask
 * `createInitialEnrollment` for a `SUPERSEDED` row — without loosening the
 * signatures to the full enum.
 */
type InitialStatus = 'ACTIVE' | 'PENDING';
type SupersedeOrigin = 'CORRECTION' | 'TRANSFER';
type ClosingStatus = 'SUPERSEDED';

/** Who performed a placement operation. */
export interface EnrollmentActor {
  userId?: string | null;
  role?: string | null;
  /** A migration importer or a scheduled job. Skips the permission check only. */
  system?: boolean;
}

/**
 * The first placement of a spell of study.
 *
 * Every scope value is supplied by the orchestrator from the **Admission's own
 * lineage**, never from the caller's request context. That distinction is the
 * whole of §29.3: the context authorises the operation, the resource populates
 * the row, and where they disagree the request is refused rather than
 * reconciled in the context's favour.
 */
export interface CreateInitialEnrollmentInput {
  organizationId: string;
  branchId: string;
  academicYearId: string;
  admissionId: string;
  studentId: string;
  programId: string;
  academicUnitId: string;

  /** Defaults to `ADMISSION`. `MIGRATION` and `READMISSION` are the importers. */
  originType?: EnrollmentOriginType;
  enrollmentKind?: EnrollmentKind;
  /** Defaults to `ACTIVE`; `PENDING` for a placement not yet in effect. */
  enrollmentStatus?: InitialStatus;

  isRepeat?: boolean;
  rollNumber?: string | null;
  /** Provenance only. Never used to look anything up. */
  applicantId?: string | null;
  createdBy?: string | null;
}

/** The replacement half of a supersede. */
export interface SupersedeEnrollmentInput {
  /** The row being replaced. Locked before anything is decided. */
  enrollmentId: string;
  originType: SupersedeOrigin;
  /**
   * What the old row becomes. Always `SUPERSEDED` for a same-branch operation.
   *
   * `TRANSFERRED` belongs to the *branch* transfer (Phase 6), where the
   * replacement sits under a different Admission. Using it here would leave the
   * old row counting as live in `enrollment_one_primary_per_year`, which
   * excludes only SUPERSEDED and CANCELLED — so the replacement could never be
   * written. What separates a correction from a genuine mid-year move is
   * `originType`, not the closing status.
   */
  closingStatus: ClosingStatus;
  reason: string;

  /** Placement of the replacement. Omitted values are carried over. */
  programId?: string;
  academicUnitId?: string;
  rollNumber?: string | null;

  /** Refuse if the row has moved on since the caller read it. */
  expectedVersion?: number;
}

export interface CancelEnrollmentInput {
  reason: string;
  exitReason?: AdmissionExitReason;
  exitDate?: Date;
  expectedVersion?: number;
}

export interface AssignRollNumberInput {
  /** `null` clears the position, which is not the same as leaving it alone. */
  rollNumber: string | null;
  expectedVersion?: number;
}

/** Filters for the operational list queries (§118–§122). */
export interface EnrollmentSearchParams {
  studentId?: string;
  admissionId?: string;
  academicYearId?: string;
  programId?: string;
  academicUnitId?: string;
  enrollmentStatus?: EnrollmentStatus;
  enrollmentKind?: EnrollmentKind;
  limit?: number;
  offset?: number;
}

export const ENROLLMENT_SEARCH_DEFAULT_LIMIT = 50;
export const ENROLLMENT_SEARCH_MAX_LIMIT = 200;
