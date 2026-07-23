# CampusFlow ERP – Admissions Production Audit Report
**Document ID:** `admissions-production-audit.md`  
**Auditor:** Principal Software Architect & Lead Backend Engineer  
**Status:** Hardened & Validated (Phase 1)

---

## 1. Admissions Masters Module

### Purpose & Responsibilities
The **Admissions Masters Module** is responsible for managing structural reference lists used throughout the Admissions pipeline. These reference tables classify data, enforce standardization, and feed dropdown fields on the frontend. The master tables include: `Religion`, `Caste`, `Category`, `Gender`, `BloodGroup`, `Language` (Mother Tongue), `Disability`, `RelationType`, `Quota`, and `AdmissionSource`.

### Architecture Structure
*   **Controller:** Class `BaseMasterController` is dynamically inherited by specific controllers (e.g., `ReligionController`, `QuotaController`).
*   **Service:** [BaseMasterService](file:///d:/ERP/backend/src/modules/admissions/masters/base-master.service.ts) provides standard CRUD queries using dynamic Prisma client references.
*   **DTOs:** `CreateMasterDto` and `UpdateMasterDto`.
*   **Guards:** [BranchGuard](file:///d:/ERP/backend/src/common/guards/branch.guard.ts) enforces branch context via `@RequireBranch()`.
*   **Permissions:** Creation/deletion restricted to `SUPER_ADMIN`, `ORG_ADMIN`, `BRANCH_ADMIN`. Reading allowed for `STAFF`.
*   **Database Tables:** `"Religion"`, `"Caste"`, `"Category"`, `"Gender"`, `"BloodGroup"`, `"Language"`, `"Disability"`, `"RelationType"`, `"Quota"`, `"AdmissionSource"`.

### Stored Fields Matrix (Applicable to all Masters)
| Field | Type | Purpose | Required | Editable | Immutable | Audit Importance |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | Primary key (UUID v7) | Yes | No | Yes | Low |
| `organizationId` | UUID | Multi-tenant organization scope | No (Global if null) | No | Yes | High |
| `branchId` | UUID | Branch isolation identifier | No (Global if null) | No | Yes | High |
| `code` | String | Unique reference identifier (e.g. "OBC", "GEN") | Yes | Yes | No | High |
| `name` | String | User-facing descriptive name (e.g. "General Category") | Yes | Yes | No | Medium |
| `description` | String | Long text clarification of the value classification | No | Yes | No | Low |
| `displayOrder` | Integer | Sorting order for frontend dropdowns | Yes | Yes | No | Low |
| `isActive` | Boolean | Toggles visibility in drop-downs | Yes | Yes | No | High |
| `metadata` | JSON | Dynamic attribute mappings | No | Yes | No | Medium |

### Sub-Module Audit Review
*   **Pagination:** Disabled. Masters return full arrays due to low row count (typically $< 100$ records per branch).
*   **Search:** Supported via case-insensitive contains filters on `name` and `code`.
*   **Sorting:** Ordered by `displayOrder` ascending.
*   **Soft Delete:** Enabled. Marked using `deletedAt`. Soft-deleted masters are excluded from active dropdown endpoints, but their reference mappings remain in database rows to protect historical records.
*   **Duplicate Detection:** Code and Name uniqueness are checked case-insensitively at the service layer inside `BaseMasterService.create`.
*   **Reference Protection:** Missing in code. Deleting a master does not block if the ID is actively linked to an applicant (documented as a future Phase 2 check).
*   **Logging & Audit:** The global `AuditLog` does not track master updates.
*   **Security:** Branch isolation is checked via `BranchGuard`. Organization checks prevent modification across tenant boundaries.

---

## 2. Applicant Module

### Purpose & Responsibilities
The **Applicant Module** forms the transactional pipeline core. It tracks prospect data from entry (`DRAFT`) through evaluation up to final decision (`APPROVED`, `REJECTED`, or `CANCELLED`).

### Architecture Structure
*   **Controller:** [ApplicantController](file:///d:/ERP/backend/src/modules/admissions/applicant/applicant.controller.ts)
*   **Service:** [ApplicantService](file:///d:/ERP/backend/src/modules/admissions/applicant/applicant.service.ts)
*   **DTOs:** `CreateApplicantDto`, `UpdateApplicantDto`, `QueryApplicantDto`, `CheckDuplicatesDto`
*   **Guards:** `BranchGuard` (`@RequireBranch()`) and `AcademicYearGuard` (`@RequireAcademicYear()`)
*   **Permissions:** Created and updated by `SUPER_ADMIN`, `ORG_ADMIN`, `BRANCH_ADMIN`, and `STAFF`. Soft-deleted by administrators only.
*   **Database Table:** `"Applicant"`

### Stored Fields Matrix
| Field | Type | Purpose | Required | Editable | Immutable | Audit Importance |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | Primary key (UUID v7) | Yes | No | Yes | Low |
| `organizationId` | UUID | Multi-tenant organization scope | Yes | No | Yes | High |
| `branchId` | UUID | Branch isolation identifier | Yes | No | Yes | High |
| `academicYearId` | UUID | Academic year scope | Yes | No | Yes | High |
| `admissionFormNo` | String | Auto-generated form number | Yes | No | Yes | High |
| `applicationNo` | String | Auto-generated official application number | Yes | No | Yes | High |
| `firstName` | String | Legal first name of the candidate | Yes | Yes (if status is DRAFT/UNDER_REVIEW) | No | Medium |
| `lastName` | String | Legal last name of the candidate | Yes | Yes | No | Medium |
| `dob` | Date | Date of birth | Yes | Yes | No | High |
| `genderId` | UUID | Foreign key reference to Gender Master | Yes | Yes | No | Medium |
| `primaryMobile` | String | Contact phone (Primary) | Yes | Yes | No | High |
| `aadhaarNo` | String | Unique government identifier (12 digits) | No | Yes | No | High |
| `admissionStatus` | String | Current workflow status | Yes | No (Only via transition API) | No | Critical |

### Sub-Module Audit Review
*   **Pagination:** Enabled via `QueryApplicantDto` (`page`, `limit`).
*   **Search:** Supported via `search` query parameter, matching `displayName`, `primaryMobile`, `aadhaarNo`, `applicationNo`, and `admissionFormNo`.
*   **Sorting:** Configurable sorting on any column (defaults to `createdAt desc`).
*   **Soft Delete:** Marks row with `deletedAt` timestamp. Service queries filter out deleted applicants. Soft delete is blocked if the applicant's status is already `APPROVED`, `REJECTED`, or `CANCELLED`.
*   **Duplicate Detection:** A specific endpoint `admissions/applicants/check-duplicates` scans for matching `aadhaarNo`, `primaryMobile`, or combination of case-insensitive `firstName` + `lastName` + `dob`.
*   **Reference Protection:** The applicant is frozen if they transition out of `DRAFT` or `SUBMITTED`. Once in `APPROVED` status, the record is locked against direct edits.

---

## 3. Guardian Module

### Purpose & Responsibilities
The **Guardian Module** manages profiles of parents, legal guardians, foster parents, and emergency contacts. It decouples parent data from applicants to support multi-child households.

### Architecture Structure
*   **Controller:** [GuardiansController](file:///d:/ERP/backend/src/modules/admissions/guardians/guardians.controller.ts)
*   **Service:** [GuardiansService](file:///d:/ERP/backend/src/modules/admissions/guardians/guardians.service.ts)
*   **DTOs:** `CreateGuardianDto`, `UpdateGuardianDto`
*   **Guards:** `BranchGuard`
*   **Database Table:** `"Guardian"`

### Stored Fields Matrix
| Field | Type | Purpose | Required | Editable | Immutable | Audit Importance |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | Primary key (UUID v7) | Yes | No | Yes | Low |
| `organizationId` | UUID | Tenant tracking ID | Yes | No | Yes | High |
| `branchId` | UUID | Branch scope identifier | Yes | No | Yes | High |
| `firstName` | String | Legal first name | Yes | Yes | No | Medium |
| `mobilePrimary` | String | Mobile number (Primary) | Yes | Yes | No | High |
| `aadhaarNo` | String | Government Aadhaar number | No | Yes | No | High |
| `email` | String | E-mail address | No | Yes | No | Medium |

### Sub-Module Audit Review
*   **Pagination:** Disabled on search queries (caps returns to top 10 items for performance).
*   **Search:** Supported via phone number, Aadhaar, or name matches.
*   **Soft Delete:** Support exists in schema but no service method or API endpoint exists to trigger deletion in the codebase.
*   **Duplicate Detection:** Handled at user lookup time (searching matching mobile or Aadhaar before adding a new guardian profile).

---

## 4. Guardian Mapping Module

### Purpose & Responsibilities
Maintains relationships between `Applicant` and `Guardian` entities. Tracks flags like `isPrimary`, `isEmergencyContact`, `isFinancialGuardian`, and `pickupAllowed`.

### Architecture Structure
*   **Controller:** Nested inside `GuardiansController` (`admissions/guardians/applicant/:applicantId/map`).
*   **Service:** Managed by `GuardiansService.mapGuardianToApplicant`.
*   **DTOs:** `MapGuardianDto`.
*   **Database Table:** `"ApplicantGuardianMapping"`.

### Stored Fields Matrix
| Field | Type | Purpose | Required | Editable | Immutable | Audit Importance |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | Yes | No | Yes | Low |
| `applicantId` | UUID | Reference to applicant | Yes | No | Yes | High |
| `guardianId` | UUID | Reference to guardian | Yes | No | Yes | High |
| `relationTypeId` | UUID | Reference to Relation Type Master | Yes | Yes | No | High |
| `isPrimary` | Boolean | True if primary contact for child | Yes | Yes | No | Critical |
| `isEmergencyContact`| Boolean | Emergency dispatch flag | Yes | Yes | No | High |
| `isFinancialGuardian`| Boolean | Responsible for fee bills | Yes | Yes | No | Critical |

### Sub-Module Audit Review
*   **Uniqueness Validation:** Enforced via composite key `@@unique([applicantId, guardianId])`.
*   **Transaction Boundary Issue:** Setting a new guardian as `isPrimary` will toggle `isPrimary = false` on current mappings first, and then execute `upsert` on the target mapping. This is not wrapped in a database transaction in `guardians.service.ts`, representing a critical transaction safety issue.

---

## 5. Workflow & Workflow History Module

### Purpose & Responsibilities
Defines and executes state transitions of applicants, logging the history of transitions for audit compliance.

### Architecture Structure
*   **Controller:** `WorkflowController`
*   **Service:** [WorkflowService](file:///d:/ERP/backend/src/modules/admissions/workflow/workflow.service.ts)
*   **DTOs:** `TransitionDto`
*   **Database Table:** `"WorkflowHistory"`

### Stored Fields Matrix (`WorkflowHistory`)
| Field | Type | Purpose | Required | Editable | Immutable | Audit Importance |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | Yes | No | Yes | Low |
| `applicantId` | UUID | Target applicant | Yes | No | Yes | High |
| `oldStatus` | String | Status before change | No (Null if initial draft) | No | Yes | Critical |
| `newStatus` | String | Status after change | Yes | No | Yes | Critical |
| `actionType` | String | Short verb (e.g. SUBMIT, APPROVE) | Yes | No | Yes | High |
| `remarks` | String | Auditor reason comments | No | No | Yes | Medium |
| `actionBy` | String | User UUID who initiated change | No | No | Yes | High |

### Sub-Module Audit Review
*   **State Machine Boundaries:** Transition checks are validated against a hardcoded NestJS memory matrix `VALID_TRANSITIONS` inside `WorkflowService`.
*   **Transactions:** The state mutation, date tracking update, history insertion, and conversion hook are correctly executed inside a Prisma transaction boundary.

---

## 6. Enrollment Module

### Purpose & Responsibilities
Facilitates the conversion of an `APPROVED` applicant into an active academic placement. Links the applicant to a program and a specific class/section unit.

### Architecture Structure
*   **Controller:** [EnrollmentController](file:///d:/ERP/backend/src/modules/admissions/enrollment/enrollment.controller.ts)
*   **Service:** [EnrollmentService](file:///d:/ERP/backend/src/modules/admissions/enrollment/enrollment.service.ts)
*   **DTOs:** `CreateEnrollmentDto`
*   **Guards:** `BranchGuard` and `AcademicYearGuard`
*   **Database Table:** `"Enrollment"`

### Stored Fields Matrix
| Field | Type | Purpose | Required | Editable | Immutable | Audit Importance |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | Yes | No | Yes | Low |
| `organizationId` | UUID | Tenant Scope | Yes | No | Yes | High |
| `branchId` | UUID | Branch Scope | Yes | No | Yes | High |
| `academicYearId` | UUID | Academic Year Scope | Yes | No | Yes | High |
| `applicantId` | UUID | Linked applicant ID | Yes | No | Yes | Critical |
| `programId` | UUID | Target Program ID | Yes | Yes | No | Critical |
| `academicUnitId` | UUID | Target class/section ID | Yes | Yes | No | Critical |
| `rollNumber` | String | Allocated roll sequence number | No | Yes | No | High |
| `enrollmentStatus` | String | Status (ACTIVE, PROMOTED) | Yes | Yes | No | High |

---

## 7. Admission Numbering Module

### Purpose & Responsibilities
Provides transaction-safe sequence generators for Form Numbers, Application Numbers, Roll Numbers, and Student IDs.

### Architecture Structure
*   **Controller:** `NumberingController`
*   **Service:** [NumberingService](file:///d:/ERP/backend/src/modules/admissions/numbering/numbering.service.ts)
*   **DTOs:** `CreateNumberSequenceConfigDto`
*   **Database Tables:** `"NumberSequenceConfig"`, `"NumberSequenceCounter"`

### Stored Fields Matrix (`NumberSequenceConfig`)
| Field | Type | Purpose | Required | Editable | Immutable | Audit Importance |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | Yes | No | Yes | Low |
| `purpose` | String | Reference keyword (e.g. "APPLICATION") | Yes | No | Yes | High |
| `prefix` | String | Start format prefix | No | Yes | No | Medium |
| `format` | String | String mapping format containing placeholders | Yes | Yes | No | High |
| `resetStrategy` | String | Strategy (NEVER, YEARLY) | Yes | Yes | No | High |

---

## 8. Audit & Logging Integration Review

### Request Context Details
The backend utilizes `RequestContextMiddleware` to map metadata on incoming request objects. The fields extracted are:
*   `requestId` (mapped via custom interceptor)
*   `userId` / `role` (via JwtAuthGuard context)
*   `branchId` (from request header `x-branch-id`)
*   `academicYearId` (from request header `x-academic-year-id`)

### Logging Implementation Gaps
*   **Logging Implementation Gaps:** Direct logging of controller endpoints is missing. Although errors are caught by `GlobalExceptionFilter` and logged via Pino, successful operations (applicant registrations, status updates, guardian links) are not explicitly logged.
*   **Audit Integration Gaps:** Although a database-level `AuditLog` table exists, the Admissions service logic does not actively insert rows there during mutations.
*   **Downstream Action Tracking:** Operations like mapping a guardian to an applicant or updating configurations are logged in debug consoles, but lack structured tracking showing who changed which value.

---

## 9. Guardian Review & Future Architecture Recommendation

### Current Implementation Flow
1. **Guardian Creation:** The client must first send a POST request to `admissions/guardians` to create a guardian profile. The backend generates a Guardian UUID.
2. **Guardian Search:** When registering siblings, the frontend must run a GET request to search guardians by phone or Aadhaar to find existing profiles.
3. **Applicant-Guardian Mapping:** After creating or finding the Guardian UUID, the client must trigger a separate POST request to `admissions/guardians/applicant/:applicantId/map` to establish the relationship linking record.
4. **Result:** Requires multiple client-server roundtrips, exposing relational mapping complexities directly to the client interface.

### Recommended Future Architecture (Transparent Guardian Sync)
To simplify integration and prevent mapping errors, the backend should expose a single unified interface:

1. **Single Payload Submission:** The frontend registers an applicant and submits nested guardian arrays in the same request payload:
   ```json
   {
     "firstName": "John",
     "lastName": "Doe",
     "guardians": [
       {
         "firstName": "Robert",
         "lastName": "Doe",
         "mobilePrimary": "+919999999999",
         "relation": "FATHER",
         "isPrimary": true
       }
     ]
   }
   ```
2. **Automated Backend Lookup & Deduplication:**
   * Backend checks if a guardian with matching `mobilePrimary` or `aadhaarNo` already exists in the database.
   * If **found**: Reuses the existing guardian entity and updates details (occupation, address) if changes are provided in the payload.
   * If **not found**: Creates a new guardian entity.
3. **Automated Link Management:**
   * Backend automatically initializes the `ApplicantGuardianMapping` record using transaction boundaries, establishing relationships and enforcing primary contact rules.
4. **Benefits:** 
   * Reduces client-side validation logic.
   * Prevents duplicate guardian profiles.
   * Guarantees transactional database writes (mapping and profile updates succeed or fail together).
