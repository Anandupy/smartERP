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

## 📁 Domain Folder Hierarchy

Endpoints are automatically grouped into 5 enterprise domain folders:

1. 📁 **1. Authentication & Session Management**: `/auth/*`, `/users/*`
2. 📁 **2. Organization & Campus Administration**: `/organizations/*`, `/branches/*`, `/system-settings/*`
3. 📁 **3. Academic Management**: `/academic-years/*`, `/programs/*`, `/academic-units/*`
4. 📁 **4. Admissions & Registration**: `/admissions/applicants/*`, `/admissions/guardians/*`, `/admissions/enrollment/*`, `/admissions/workflow/*`
5. 📁 **5. Admissions Masters**: `/admissions/masters/*` (Quotas, Religions, Castes, Categories, Disabilities, Genders, Languages, Blood Groups, Relation Types)

---

## 🌍 Postman Environment Support

Running `pnpm postman:generate` produces `postman/erp.environment.json` pre-configured with:
- `baseUrl`: `http://localhost:3000`
- `accessToken`: Auto-captured from `/auth/login`
- `organizationId`, `branchId`, `academicYearId`
- All discovered resource IDs (`applicantId`, `programId`, `academicUnitId`, `guardianId`, `userId`, `quotaId`, `genderId`, `categoryId`, etc.)
