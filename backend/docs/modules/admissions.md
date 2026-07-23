# Admissions Foundation Module Documentation

## 1. Overview
The **Admissions Foundation Module** provides the core intake, lifecycle, and mapping infrastructure for the multi-tenant School ERP platform. It manages the applicant transition pipeline from initial application submission to formal approval and academic placement.

---

## 2. Why Applicant ≠ Student
In an enterprise ERP, it is a critical anti-pattern to represent active students and applicants in the same table.
* **Applicant**: Represents a short-lived enquiry, draft form, review candidate, or converted registration. It is transactional and volatile.
* **Student**: Represents a permanent institutional identity with active enrollment histories, fee accounts, course grades, and attendance.
Applicants only trigger a permanent **Student** record creation hook *after* their application is marked `APPROVED`.

---

## 3. Why Enrollment ≠ Student Identity
* **Student Identity**: A permanent user/profile record unique to the individual across multiple academic years.
* **Enrollment**: An academic assignment connecting a student profile to a specific **Branch**, **Academic Year**, **Program**, and **Academic Unit (class/section)**. An applicant can be placed into an enrollment template, which converts into an active student enrollment upon final matriculation.

---

## 4. Folder Structure
The module follows a **feature-first modular structure** under `src/modules/admissions/`:
```
src/modules/admissions/
├── masters/           # 10 Master data entities (Religion, Caste, Category, Gender, etc.)
├── applicant/         # Applicant intake and lifecycle services/controllers
├── guardians/         # Normalised Guardian records and many-to-many Sibling mapping
├── numbering/         # Transaction-safe formatted sequence generator
├── workflow/          # Transactional state transitions and history logging
└── enrollment/        # Simple academic placement templates
```

---

## 5. Applicant Lifecycle & Workflow States
Applications transition through the following states via strict transition matrices:
```
  [DRAFT] ────> [SUBMITTED] ────> [UNDER_REVIEW] ───┬───> [APPROVED]
     │               │                   │           ├───> [DOCUMENT_PENDING]
     └───────────────┴───────────────────┴───────────┼───> [FEE_PENDING]
                     │                   │           ├───> [WAITLISTED]
                     └───────────────────┴───────────┼───> [REJECTED]
                                                     └───> [CANCELLED]
```
### Valid Transition Rules:
* Transitions out of terminal states (`APPROVED`, `REJECTED`, `CANCELLED`) are strictly blocked.
* Log audits are recorded automatically in the `WorkflowHistory` table.

---

## 6. Number Generation Architecture
To guarantee concurrent safety, sequence counters utilize atomic updates via row locking:
```sql
UPDATE "NumberSequenceCounter"
SET "currentValue" = "currentValue" + 1
WHERE "id" = :counterId
RETURNING "currentValue";
```
Configurable formats support placeholders:
* `{prefix}`: Custom string (e.g. `ADM`)
* `{branchCode}`: Resolved from Branch profile
* `{year}`: Resolved from current Academic Year
* `{sequence}`: 0-padded sequence number

---

## 7. Guardian / Sibling Relationship System
Rather than hardcoding mother/father columns, the system uses a normalized relationship table:
* **Guardian**: Stores unique personal information (Aadhaar, contact, address).
* **ApplicantGuardianMapping**: Associates a guardian to multiple applicants with custom attributes (`isPrimary`, `pickupAllowed`, `priority`).
This enables easy sibling discovery and reuses parent profiles during registration.

---

## 8. Multi-Tenancy & Isolation Strategy
* **Tenant Isolation**: Every operational entity holds `organizationId` and `branchId` foreign keys.
* **Branch Switching**: Roles Guard dynamically overrides the request context branch parameters for non-super-admins, ensuring database actions stay sandboxed inside authorized scopes.

---

## 9. Duplicate Warning Engine
Before finalizing an applicant create or submit action, the warning engine executes check matches:
1. Match on `aadhaarNo` (if populated).
2. Match on `primaryMobile`.
3. Match on Fuzzy Name + Date of Birth.
Matches return non-blocking warning arrays to alert admins of potential duplicates.

---

## 10. Future Extensibility
* **Applicant-to-Student Hook**: Triggered automatically in `WorkflowService` when transitioning to `APPROVED`.
* **Seat Capacity Validation**: Integrates inside the approval transition transaction.

---

## 11. Domain Events & Audit Flow
The Admissions module publishes the following events over the shared `EventBus` to integrate with the core `AuditListener`:

* **`applicant.created`**: Fired when a draft applicant is created.
* **`applicant.updated`**: Fired when applicant demographics/addresses/previous education fields are updated.
* **`applicant.deleted`**: Fired when an applicant is soft-deleted.
* **`guardian.created`**: Fired when a guardian is registered.
* **`guardian.updated`**: Fired when guardian details are updated.
* **`guardian.mapped`**: Fired when a guardian is associated with an applicant.
* **`guardian.unmapped`**: Fired when a guardian association is removed.
* **`admission.transitioned`**: Fired when the applicant transitions status (e.g., DRAFT -> SUBMITTED, UNDER_REVIEW -> APPROVED, etc.).
* **`enrollment.completed`**: Fired when academic placement templates are finalized.
* **`numbering_config.created`**: Fired when numbering sequences are configured.
* **`admissions_master.created`**: Fired when lookups (Religion, Caste, etc.) are registered.
* **`admissions_master.updated`**: Fired when lookups are updated.
* **`admissions_master.deleted`**: Fired when lookups are soft-deleted.

All events are handled asynchronously by the `AuditListener`, preserving the fast execution of core admission workflows.

