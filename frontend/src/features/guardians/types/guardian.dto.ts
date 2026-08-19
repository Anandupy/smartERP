/**
 * Wire shapes for `/v1/admissions/guardians`, the applicant-guardian mapping
 * endpoints, and the read-only `/v1/admissions/guardianships/*` surface.
 *
 * Sourced entirely from `docs/admission-lifecycle-module.md` §5 — itself
 * compiled from the backend's status-tagged reconciliation and confirmed
 * Postman example bodies. Guardian, ApplicantGuardianMapping and
 * Guardianship are deliberately three separate shapes here, matching the
 * backend's own separation (module doc §5.1, §5.4, §5.6) — never merged into
 * one "guardian" object.
 */

/**
 * A guardian record, as `POST`/`GET`/`PATCH /admissions/guardians` confirm
 * it (module doc §5.2).
 *
 * Still branch-scoped and still carries a plaintext `aadhaarNo` today — the
 * target organization-scoped, Person-only-address model is designed but not
 * yet migrated (`docs/backend-gaps.md` GD1). `personId` is real but
 * **nullable**: it is set only once a `dob` has been supplied (once at
 * create, or later via an edit) and `PersonService.resolve()` could run.
 */
export interface GuardianDto {
  id: string;
  organizationId: string;
  branchId: string;
  personId: string | null;

  dob: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  mobilePrimary: string;
  mobileSecondary: string | null;
  email: string | null;
  occupation: string | null;
  income: number | null;

  /** Plaintext today — `docs/backend-gaps.md` AP3/GD1. Handle like any Aadhaar field. */
  aadhaarNo: string | null;

  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  pincode: string | null;

  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/**
 * Body for `POST /admissions/guardians` and `PATCH .../:id` — the exact 16
 * fields Postman documents, plus the transient `dob` R4.5 added to let a
 * guardian resolve identity without ever storing the date on the row itself
 * where the design didn't ask for it (module doc §5.3). Full body always
 * sent; no partial-update rule is documented.
 */
export interface GuardianRequest {
  dob: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  mobilePrimary: string;
  mobileSecondary: string | null;
  email: string | null;
  occupation: string | null;
  income: number | null;
  aadhaarNo: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  pincode: string | null;
}

/**
 * `ApplicantGuardianMapping` — confirmed field-for-field via
 * `POST /admissions/guardians/applicant/:applicantId/map` (module doc §5.4).
 * This is the applicant-scoped relationship; it is **not** the same row as
 * `Guardianship` below.
 */
export interface ApplicantGuardianMappingDto {
  id: string;
  applicantId: string;
  guardianId: string;
  relationTypeId: string;
  isPrimary: boolean;
  isEmergencyContact: boolean;
  isFinancialGuardian: boolean;
  pickupAllowed: boolean;
  priority: number | null;
  createdAt: string;
  updatedAt: string;
  /** Present on the list read (`GET .../applicant/:applicantId`) only. */
  guardian?: GuardianDto;
}

/** Body for `POST /admissions/guardians/applicant/:applicantId/map`. Idempotent. */
export interface MapGuardianRequest {
  guardianId: string;
  relationTypeId: string;
  isPrimary: boolean;
  isEmergencyContact: boolean;
  isFinancialGuardian: boolean;
  pickupAllowed: boolean;
  priority: number | null;
}

/**
 * A `Guardianship` row (Person ↔ Person), read-only from this API surface
 * (module doc §5.6) — no `POST /guardianships` exists. Field list is not
 * expanded by any captured example beyond the ids; typed conservatively.
 */
export interface GuardianshipDto {
  id?: string;
  guardianPersonId?: string;
  wardPersonId?: string;
  relationTypeId?: string;
  isPrimary?: boolean;
  isFinancialGuardian?: boolean;
  [key: string]: unknown;
}

/**
 * `GET /admissions/guardians/search?q=` result row. Field list not expanded
 * beyond the guardian shape itself in the captured example — treated as a
 * `GuardianDto`, since the endpoint's purpose (module doc §5.6) is finding an
 * existing guardian to reuse.
 */
export type GuardianSearchResult = GuardianDto;
