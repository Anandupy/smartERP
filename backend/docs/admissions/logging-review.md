# CampusFlow ERP – Admissions Logging Review
**Document ID:** `logging-review.md`  
**Status:** Completed Audit (Phase 1)

---

## 1. Request Context Logging Baseline

CampusFlow utilizes a unified NestJS request logging middleware. For every incoming API transaction, the following context parameter mappings are logged:

*   **`requestId`:** Generated for every request (`uuid` v4) to trace the execution path.
*   **`organizationId` (tenantId):** Resolved from token/context to track multi-tenancy.
*   **`branchId`:** Extracted from header parameter context keys.
*   **`academicYearId`:** Extracted from header parameter context keys.
*   **`userId`:** Extracted from parsed user authorization tokens.

---

## 2. Standardized Log Schema

To maintain compatibility with Pino/Elasticsearch indexes, all structured logs should emit in this format:

```json
{
  "timestamp": "2026-07-23T20:25:30.000Z",
  "level": "info",
  "requestId": "5e172465-9b2f-4e50-bd11-85b86ea614a9",
  "organizationId": "d3b07384-d113-4c4f-9e6b-000000000000",
  "branchId": "c4d08129-e224-4f5a-8b1a-111111111111",
  "academicYearId": "a1b2c3d4-e5f6-7a8b-9c0d-222222222222",
  "userId": "u7b6c5d4-e3f2-1a0b-9c8d-333333333333",
  "action": "CREATE_APPLICANT",
  "entity": "Applicant",
  "entityId": "f7b6c5d4-e3f2-1a0b-9c8d-444444444444",
  "status": "SUCCESS",
  "durationMs": 45
}
```

---

## 3. Sensitive Data Filtering Guidelines (PII Masking)

To comply with global data regulations (e.g. GDPR, DPDP Act), sensitive student and family variables must never be printed to raw files or stdout streams in plain text.

### Masking Rules Matrix
| Field Name | Logging Rule | Masking Pattern |
| :--- | :--- | :--- |
| `aadhaarNo` | Mask | Replace first 8 digits with `*` (e.g. `********1234`) |
| `primaryMobile` | Mask | Replace middle digits with `*` (e.g. `+91*****5678`) |
| `email` | Mask | Partially obscure email handle (e.g. `j***e@domain.com`) |
| `passwordHash` | Block | Completely filter out of log parameters |
| `token` / `cookie` | Block | Completely filter out of log parameters |
| `income` | Block | Financial indicators should never be printed in debug loops |

---

## 4. Current Implementations & Gaps

*   **Pino Integration:** Integrated at application startup. Interceptors parse incoming path endpoints and log basic HTTP metadata (method, route, execution time).
*   **Audit Logger Hook Gaps:** While the database has an `AuditLog` table, the Admissions service logic does not actively insert rows there during mutations.
*   **Downstream Action Tracking:** Operations like mapping a guardian to an applicant or updating configurations are logged in debug consoles, but lack structured tracking showing who changed which value.

---

## 5. Hardening Actions (Phase 1)

1.  **Exception Sanitization:** Ensure the exception filter prints raw trace maps using the Pino logger stream (`this.logger.error(...)`) while mapping only generic descriptions to users.
2.  **DTO Validation Logs:** Validation failures now output summarized validation lists in structured request-response logs under `BadRequestException` logs.
