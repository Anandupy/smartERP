# CampusFlow ERP – Admissions Validation Matrix
**Document ID:** `admissions-validation-matrix.md`  
**Scope:** Validation rules for Applicant, Guardian, Enrollment, and Master schemas.

---

## 1. Field-Level Validation Flow

Validations are executed in this strict sequence:
1.  **Request Input:** Payload is parsed from JSON.
2.  **DTO Validation:** NestJS class-validator runs structural filters (e.g. `@IsEmail()`, `@Matches()`).
3.  **Business Validation:** Service checks states and lifecycle conditions (e.g. "Status must be DRAFT to allow updates").
4.  **Reference Validation:** Service verifies foreign key references exist in database and are not soft-deleted.
5.  **Transaction Boundary:** Opens DB transaction.
6.  **Database Constraints:** DB checks unique keys and composite indexes.
7.  **Response:** Success status or translated exception envelope.

---

## 2. Validation Matrix Details

### A. Applicant Schema Fields

#### 1. `firstName`
*   **Required/Optional:** Required
*   **Data Type:** String
*   **Business Meaning:** Legal first name of the applicant.
*   **DTO Validation:** `@IsString()`, `@IsNotEmpty()`
*   **Business Validation:** None
*   **Database Constraint:** `NOT NULL` in Postgres
*   **Duplicate Check:** Combined with `lastName` and `dob` case-insensitively during pre-submit check.
*   **Reference Validation:** None
*   **Error Message Returned:** `"firstName must be a string"`, `"firstName should not be empty"`
*   **Example Invalid Request:** `{"firstName": ""}`
*   **Example API Response:**
    ```json
    {
      "success": false,
      "code": "BadRequestException",
      "message": "firstName should not be empty",
      "requestId": "req-12345",
      "timestamp": "2026-07-23T20:25:00.000Z"
    }
    ```

#### 2. `dob`
*   **Required/Optional:** Required
*   **Data Type:** Date (ISO String)
*   **Business Meaning:** Candidate's date of birth. Used for age eligibility calculations.
*   **DTO Validation:** `@IsDateString()`
*   **Business Validation:** Must represent a valid past date.
*   **Database Constraint:** `TIMESTAMP` type, `NOT NULL`
*   **Duplicate Check:** Used in matching combinations.
*   **Reference Validation:** None
*   **Error Message Returned:** `"dob must be a valid ISO 8601 date string"`
*   **Example Invalid Request:** `{"dob": "10-05-2015"}`
*   **Example API Response:**
    ```json
    {
      "success": false,
      "code": "BadRequestException",
      "message": "dob must be a valid ISO 8601 date string",
      "requestId": "req-12346",
      "timestamp": "2026-07-23T20:25:01.000Z"
    }
    ```

#### 3. `genderId`
*   **Required/Optional:** Required
*   **Data Type:** UUID
*   **Business Meaning:** Reference to Gender master classification.
*   **DTO Validation:** `@IsString()`, `@IsNotEmpty()`
*   **Business Validation:** None
*   **Database Constraint:** Foreign key constraint to `"Gender"` table
*   **Duplicate Check:** None
*   **Reference Validation:** Checked in `ApplicantService.create` to ensure the ID is active and `deletedAt` is null.
*   **Error Message Returned:** `"Gender with ID [uuid] not found"` or `"Selected Gender does not exist."`
*   **Example Invalid Request:** `{"genderId": "bf5be106-96b0-4a81-9b1a-000000000000"}`
*   **Example API Response:**
    ```json
    {
      "success": false,
      "code": "REFERENCE_NOT_FOUND",
      "message": "Selected Gender does not exist.",
      "requestId": "req-12347",
      "timestamp": "2026-07-23T20:25:02.000Z"
    }
    ```

#### 4. `primaryMobile`
*   **Required/Optional:** Required
*   **Data Type:** String
*   **Business Meaning:** Primary contact mobile phone.
*   **DTO Validation:** `@IsString()`, `@IsNotEmpty()`, `@Matches(/^[+0-9\s-]{7,15}$/)`
*   **Business Validation:** Checked in duplicate checks.
*   **Database Constraint:** `NOT NULL`
*   **Duplicate Check:** Explicitly checked in `checkDuplicates`.
*   **Reference Validation:** None
*   **Error Message Returned:** `"Invalid primary mobile format"`
*   **Example Invalid Request:** `{"primaryMobile": "abc-phone"}`
*   **Example API Response:**
    ```json
    {
      "success": false,
      "code": "BadRequestException",
      "message": "Invalid primary mobile format",
      "requestId": "req-12348",
      "timestamp": "2026-07-23T20:25:03.000Z"
    }
    ```

#### 5. `aadhaarNo`
*   **Required/Optional:** Optional
*   **Data Type:** String
*   **Business Meaning:** Indian national identity number.
*   **DTO Validation:** `@IsString()`, `@IsOptional()`, `@Matches(/^\d{12}$/)`
*   **Business Validation:** None
*   **Database Constraint:** Nullable
*   **Duplicate Check:** Checked as a primary unique collision warning.
*   **Reference Validation:** None
*   **Error Message Returned:** `"Aadhaar number must be exactly 12 digits"`
*   **Example Invalid Request:** `{"aadhaarNo": "12345"}`
*   **Example API Response:**
    ```json
    {
      "success": false,
      "code": "BadRequestException",
      "message": "Aadhaar number must be exactly 12 digits",
      "requestId": "req-12349",
      "timestamp": "2026-07-23T20:25:04.000Z"
    }
    ```

---

### B. Guardian Schema Fields

#### 1. `mobilePrimary`
*   **Required/Optional:** Required
*   **Data Type:** String
*   **Business Meaning:** Primary contact number for parent.
*   **DTO Validation:** `@IsString()`, `@IsNotEmpty()`, `@Matches(/^[+0-9\s-]{7,15}$/)`
*   **Business Validation:** None
*   **Database Constraint:** `NOT NULL`
*   **Duplicate Check:** Used for search/reuse identification.
*   **Error Message Returned:** `"Invalid primary mobile format"`
*   **Example Invalid Request:** `{"mobilePrimary": "invalid_phone"}`

#### 2. `email`
*   **Required/Optional:** Optional
*   **Data Type:** String (Email format)
*   **Business Meaning:** Contact email address.
*   **DTO Validation:** `@IsEmail()`, `@IsOptional()`
*   **Business Validation:** None
*   **Database Constraint:** Nullable
*   **Error Message Returned:** `"email must be an email"`
*   **Example Invalid Request:** `{"email": "not-an-email"}`

---

### C. Enrollment Schema Fields

#### 1. `programId`
*   **Required/Optional:** Required
*   **Data Type:** UUID
*   **Business Meaning:** The target academic program (e.g. B.Tech CS).
*   **DTO Validation:** `@IsString()`, `@IsNotEmpty()`
*   **Business Validation:** Verified exists during the enrollment creation phase.
*   **Database Constraint:** Foreign key to `"Program"`, `NOT NULL`.
*   **Reference Validation:** Ensured active program reference in `EnrollmentService`.
*   **Error Message Returned:** `"Program not found"` or `"Selected Program does not exist."`

#### 2. `academicUnitId`
*   **Required/Optional:** Required
*   **Data Type:** UUID
*   **Business Meaning:** Target class division or section.
*   **DTO Validation:** `@IsString()`, `@IsNotEmpty()`
*   **Business Validation:** Verified exists.
*   **Database Constraint:** Foreign key to `"AcademicUnit"`, `NOT NULL`.
*   **Reference Validation:** Checked in `EnrollmentService`.
*   **Error Message Returned:** `"Academic Unit not found"` or `"Selected Academic Unit does not exist."`
