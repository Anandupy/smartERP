# Postman Collection Generator v2

CampusFlow ERP provides an **Enterprise-Grade Automatic API Collection Generator** that converts NestJS Swagger/OpenAPI annotations into production-ready Postman Collections (`postman/erp.postman_collection.json`) and Postman Environments (`postman/erp.environment.json`).

The generated collection requires **zero manual editing** after import.

---

## 🚀 Usage

Whenever a developer creates a new module or controller, generate the updated Postman collection using:

```bash
pnpm postman:generate
```

> **Prerequisite**: Ensure the backend dev server is running on `http://localhost:3000` (or `pnpm start:dev`), as the generator fetches the live OpenAPI JSON spec from `/api-json`.

---

## 🛠️ Generator Engine Architecture

The generator engine is located under `scripts/postman/` and follows a modular architecture:

```text
scripts/postman/
├── index.ts                     # Main Generator Engine Coordinator
├── parsers/
│   └── openapi.parser.ts        # Parses OpenAPI JSON schemas and $ref definitions
├── generators/
│   ├── body.generator.ts        # Intelligent DTO request body generator & UUID faking
│   └── environment.generator.ts # Auto-discovers variables for erp.environment.json
├── builders/
│   ├── folder.builder.ts       # Maps endpoints into Enterprise Domain Folders
│   └── request.builder.ts      # Formats request names, path variables, query params & headers
└── validators/
    └── collection.validator.ts  # Validates collection integrity and checks for empty bodies
```

---

## 💡 DTO Request Body Generation Rules

Every `POST`, `PATCH`, and `PUT` request body is generated with complete 2-space indented JSON following strict priority rules:

### Priority 1: Explicit `@ApiProperty` Examples
If a DTO property includes an explicit example in Swagger:
```typescript
@ApiProperty({ example: 'Horizon High School' })
name: string;
```
The generator uses `"Horizon High School"`.

### Priority 2: Automatic UUID Variable Detection
Any DTO property ending with `Id` (or `id`, `branchId`, `academicYearId`, `programId`, `genderId`, `categoryId`, `religionId`, `applicantId`, `guardianId`, `userId`, etc.) is automatically converted into a Postman variable:
```json
{
  "branchId": "{{branchId}}",
  "genderId": "{{genderId}}",
  "categoryId": "{{categoryId}}"
}
```

### Priority 3: Semantic & Type-Based Faking
When no example is specified, the generator produces realistic semantic defaults:
- **Emails** (`email`, `primaryEmail`) $\rightarrow$ `"john.doe@example.com"`
- **Phones** (`phone`, `primaryMobile`) $\rightarrow$ `"9876543210"`
- **Names** (`firstName`, `lastName`) $\rightarrow$ `"John"`, `"Doe"`
- **Addresses** (`addressLine1`, `city`, `pincode`) $\rightarrow$ `"123 Education Lane"`, `"Mumbai"`, `"400001"`
- **Dates** (`dob`, `startDate`) $\rightarrow$ `"2008-06-15"`, `"2026-04-01"`
- **Numbers & Prices** $\rightarrow$ `1` or `85.5`
- **Booleans** $\rightarrow$ `true`
- **Enums** $\rightarrow$ First enum value

---

## 📁 Domain -> Controller Folder Hierarchy

Endpoints are automatically grouped into a 3-level enterprise hierarchy: `Domain` $\rightarrow$ `Module (Controller)` $\rightarrow$ `Requests`.

```text
Admissions
├── Applicant
│   ├── Create Applicant
│   ├── List Applicants
│   ├── Get Applicant by ID
│   ├── Update Applicant
│   └── Delete Applicant
├── Guardian
├── Enrollment
├── Workflow
├── Numbering
└── Masters
    ├── Admission Source
    ├── Blood Group
    ├── Caste
    ├── Category
    ├── Disability
    ├── Gender
    ├── Language
    ├── Quota
    ├── Relation Type
    └── Religion
```

---

## 🏷️ Request Naming Priority

Request names are generated using strict 4-level priority rules:
1. **Swagger Summary** (`@ApiOperation({ summary: '...' })`), cleaned into Title Case enterprise names.
2. **Swagger `operationId`**.
3. **Controller Name + HTTP Method + Route**.
4. **Route Analysis** (never falls back to generic placeholders).

---

## 🔢 Request Ordering within Module Folders

Requests inside each module folder are sorted in standard CRUD order:
1. `Create` (POST)
2. `List` (GET list without ID)
3. `Get` (GET with ID)
4. `Update` (PATCH/PUT)
5. `Delete` (DELETE)
6. Custom action endpoints (e.g. `Search`, `Check Duplicates`, `Activate`, `Select`, `Lock`, `Toggle Status`)

## 🌍 Postman Environment Support

Running `pnpm postman:generate` produces `postman/erp.environment.json` pre-configured with:
- `baseUrl`: `http://localhost:3000`
- `accessToken`: Auto-captured from `/auth/login`
- `organizationId`, `branchId`, `academicYearId`
- All discovered resource IDs (`applicantId`, `programId`, `academicUnitId`, `guardianId`, `userId`, `quotaId`, `genderId`, `categoryId`, etc.)
