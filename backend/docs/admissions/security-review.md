# CampusFlow ERP – Admissions Domain Security Review
**Document ID:** `security-review.md`  
**Status:** Completed Audit (Phase 1)

---

## 1. Authentication & Authorization Structure

*   **JWT Implementation:** Requests must provide a Bearer Token in the `Authorization` header. It is decoded and verified against a symmetric/asymmetric algorithm in an authentication middleware/guard.
*   **Role-Based Access Control (RBAC):** Restricts endpoints using a `@Roles(...)` decorator which maps specific actions to user roles:
    *   `SUPER_ADMIN`, `ORG_ADMIN`, `BRANCH_ADMIN`: Full administrative CRUD permissions.
    *   `STAFF`: Can view applicants, create/update applications, but cannot perform deletions or execute workflow overrides.
    *   `STUDENT`, `PARENT`: Not granted access to controller actions within the Admissions domain.

---

## 2. Multi-Dimensional Data Isolation

CampusFlow enforces data security using three distinct boundaries:

### A. Tenant (Organization) Isolation
*   **Mechanism:** Every record is stamped with a tenant identifier (`organizationId`). The JWT claims payload contains the tenant scope of the authenticated session.
*   **Enforcement:** [BranchGuard](file:///d:/ERP/backend/src/common/guards/branch.guard.ts) checks if the branch's tenant matches the user's tenant:
    ```typescript
    if (userOrgId && branch.organizationId !== userOrgId) {
      throw new ForbiddenException('Access to branch outside organization is forbidden');
    }
    ```

### B. Branch Isolation
*   **Mechanism:** Requests must supply target branch contexts in header parameters (`x-branch-id`).
*   **Enforcement:** Decorated endpoints intercept headers and execute `BranchGuard`. All DB writes automatically map context variables to write payloads, preventing cross-branch modification.

### C. Academic Year Isolation
*   **Mechanism:** Requests supply academic year context headers (`x-academic-year-id`).
*   **Enforcement:** [AcademicYearGuard](file:///d:/ERP/backend/src/common/guards/academic-year.guard.ts) ensures that applicants, configuration records, and enrollment placements remain isolated to specific registration periods.

---

## 3. Threat Vector Assessments & Hardening Actions

### A. Mass Assignment Vulnerabilities
*   **Assessment:** If fields like `admissionStatus`, `applicationNo`, or `admissionFormNo` are accepted in payload updates, users could override sequence generation or bypass admission workflows.
*   **Hardening Action:** We use explicit, strictly whitelisted class-validator DTOs (`CreateApplicantDto`, `UpdateApplicantDto`). NestJS `ValidationPipe` is globally initialized with `whitelist: true` and `forbidNonWhitelisted: true`, rejecting unexpected fields.

### B. Broken Object Level Authorization (BOLA / IDOR)
*   **Assessment:** Can a `STAFF` member from Branch A request details of an Applicant in Branch B by passing the Applicant UUID directly to the API?
*   **Code Check:** `ApplicantService.findOne` performs queries filtered only on ID:
    ```typescript
    const applicant = await this.prisma.applicant.findFirst({
      where: { id, deletedAt: null },
      ...
    });
    ```
    This bypasses branch context filtering, allowing BOLA if a user guesses a UUID.
*   **Hardening Recommendation:** Modify services to query based on both ID and active request contexts (`where: { id, branchId, deletedAt: null }`).

### C. Sensitive Data Exposure
*   **Assessment:** Aadhaar numbers, phone numbers, and student files must be secure in DB storage and during transit.
*   **Hardening Action:** API responses only return public strings. In future phases, field-level database encryption should be integrated for columns containing PII (Personally Identifiable Information).

### E. Output Sanitization
*   **Assessment:** Cross-Site Scripting (XSS) via injected strings in applicant name inputs.
*   **Hardening Action:** The backend uses standard NestJS serialization. In Phase 2, input sanitization helpers (e.g. using `dompurify` or custom regex filters) must be integrated to sanitize strings before DB storage.
