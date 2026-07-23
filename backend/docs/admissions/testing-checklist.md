# CampusFlow ERP – Admissions Testing Checklist
**Document ID:** `testing-checklist.md`  
**Status:** Hardened Target Outline (Phase 1)

---

## 1. Unit & Service Tests

*   `[ ]` **Applicant Creation references:** Validate that `ApplicantService.create` correctly fails when non-existent UUIDs are passed for masters (Religion, Category, Caste, etc.).
*   `[ ]` **Workflow state validation:** Test state transitions in `WorkflowService` using `VALID_TRANSITIONS` rules. Validate that invalid states trigger `BadRequestException`.
*   `[ ]` **Primary guardian mapping limits:** Verify that setting `isPrimary = true` on a new guardian link resets existing mappings for that applicant to `isPrimary = false`.

---

## 2. Validation & Input Tests

*   `[ ]` **Mobile phone format check:** Verify that input mobile strings not conforming to standard formats (regex: `/^[+0-9\s-]{7,15}$/`) are rejected by the API gateway with a `400 Bad Request`.
*   `[ ]` **Aadhaar digits check:** Confirm that Aadhaar card inputs not matching a 12-digit string fail validations.
*   `[ ]` **Email verification:** Test that malformed string emails in applicant and guardian payloads fail.
*   `[ ]` **Pincode validation:** Test that invalid formats are rejected.

---

## 3. Exception & Sanitization Tests

*   `[ ]` **Prisma Error Translator P2002:** Force a unique index duplicate error on `applicationNo` and verify that the API returns `"Application Number already exists."` with a `409 Conflict` status.
*   `[ ]` **Prisma Error Translator P2003:** Force a foreign key constraint violation (e.g. invalid `religionId`) and check that it translates to `"Selected Religion does not exist."` with a `400 Bad Request` status.
*   `[ ]` **Internal error sanitization:** Throw a raw runtime exception inside a service and ensure the client receives only `"An unexpected error occurred. Please contact administrator."` with a `500 Internal Server Error` status. Verify that the original stack trace is printed to internal Pino logs but hidden from the HTTP response payload.

---

## 4. Authorization & Isolation Tests

*   `[ ]` **Role checks:** Verify that roles other than administrators and staff (e.g. student, parent) are blocked from Admissions controller endpoints with a `403 Forbidden` status.
*   `[ ]` **Branch Guard check:** Confirm that requests lacking `x-branch-id` headers receive `400 Bad Request` responses.
*   `[ ]` **Academic Year Guard check:** Verify that requests without `x-academic-year-id` headers receive `400 Bad Request` responses.
*   `[ ]` **Tenant boundaries:** Attempt to access Branch B data using Branch A tenant credentials and verify that the guard throws a `403 Forbidden`.

---

## 5. Duplicate Detection Tests

*   `[ ]` **Aadhaar duplicates:** Verify that duplicate Aadhaar numbers trigger a warning output in duplicate detection reports.
*   `[ ]` **Mobile duplicate matches:** Test that matching primary phone numbers trigger warnings.
*   `[ ]` **Name & DOB logic:** Verify that matching combination keys (`firstName` + `lastName` + `dob`) flag duplicate profiles.

---

## 6. Concurrency & Integrity Tests

*   `[ ]` **Number Sequence Config upserts:** Simulate concurrent request hits on `ensureNumberConfig` and verify that the DB uses database-level upserts to prevent unique index collisions.
*   `[ ]` **Seat capacity constraints:** Test concurrent enrollment requests when seat allocations are close to program limits. Validate that row locks prevent over-enrollment.
*   `[ ]` **Double submission prevention:** Verify that duplicate application requests within a short timeframe (e.g. 2 seconds) are throttled or rejected.

---

## 7. Swagger API Documentation Tests

*   `[ ]` **Header annotations:** Ensure all admissions controllers are annotated with `@ApiHeader` definitions for both `x-branch-id` and `x-academic-year-id`.
*   `[ ]` **DTO Schema decorators:** Verify that validation rules (like character matches and limits) are properly described with `@ApiProperty` descriptors in Swagger documentation.
