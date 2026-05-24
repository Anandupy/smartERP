# 🚀 Centralized Postman Automation

This directory contains the auto-generated Postman collection and environment files for the School ERP backend.

## 📦 Files
- [erp.postman_collection.json](file:///d:/ERP/backend/postman/erp.postman_collection.json): The auto-generated API collection containing all endpoints.
- [erp.environment.json](file:///d:/ERP/backend/postman/erp.environment.json): Pre-configured local environment variables.

---

## 🏗️ Architecture Design & Philosophy

### 1. Why Centralized Generation Scales
In enterprise-grade applications, the API surface grows rapidly. Maintaining manual, module-specific Postman generation scripts leads to fragmented configurations, outdated endpoints, and developer overhead. A centralized generator automatically reads the compiled Swagger metadata of the application and converts it directly into a comprehensive, grouped Postman collection.

### 2. Why Manual Scripts are Anti-Patterns
- **Drift**: Manual scripts inevitably drift from the actual code, leading to broken tests.
- **Redundancy**: Copy-pasting boilerplate test code for every single resource is error-prone.
- **Developer Overhead**: Requiring a developer to write a custom script or manually edit JSON files for every new controller blocks rapid feature delivery.

### 3. Swagger as the Single Source of Truth
Decorators like `@ApiTags()`, `@ApiOperation()`, and standard NestJS controller routings define our API contract. By compiling Swagger (`/api-json`) as the absolute source of truth, our documentation and testing clients (Postman) are always in perfect sync.

### 4. Zero-Effort Scaling for Future Modules
When a new module is created:
```bash
nest g resource attendance
```
No manual Postman scripts are ever written. The nest resource is compiled, registered in Swagger, and the generator automatically detects the new endpoints, groups them by their controller tags, applies JWT auth inherited from the collection root, and enables them for testing.

---

## 🚀 Setup & Usage Instructions

### 1. Installation
All required dependencies are defined in the workspace devDependencies:
```bash
pnpm install
```

### 2. Running the Generator
To generate or update the Postman collection manually, ensure the backend is running, then execute:
```bash
pnpm run generate:postman
```
*Note: If the backend is offline, the script will gracefully log a setup message without crashing.*

### 3. Watch Mode (Automatic Generation)
To run the generator in watch mode (updates the collection in real-time as controllers change or new files are saved):
```bash
pnpm run generate:postman:watch
```

---

## 🔒 Advanced Testing Features Included

### 🔑 Global Authorization
The generated collection includes a **Bearer Token** authorization mechanism defined at the collection root. 
- All requests inherit this authorization automatically.
- No need to configure `Authorization: Bearer {{accessToken}}` headers manually for individual endpoints.

### 🏢 Automatic Header Handling
A collection-level pre-request script checks the active Postman environment and dynamically appends the following headers if their environment variables are populated:
- `x-tenant-id`: `{{tenantId}}`
- `x-organization-id`: `{{organizationId}}`
- `x-branch-id`: `{{branchId}}`
- `x-academic-year-id`: `{{academicYearId}}`

### 🧪 Automated Variables and Tokens Capture
A global post-request test suite is embedded at the collection level:
1. **Traceability check**: Asserts that every response contains the `x-request-id` header.
2. **Auto-Auth parsing & JWT decode**:
   - Detects the `/auth/login` response, extracts the `accessToken`, and sets it in the active environment.
   - Automatically decodes the JWT payload to populate `branchId` and `organizationId` variables, immediately preparing the environment for subsequent scoped requests.
3. **Auto-save resource IDs**:
   - When a `POST` request successfully creates a resource and returns `{ success: true, data: { id: "..." } }`, the script automatically detects the last path segment (e.g. `programs` or `blood-groups`).
   - It plural-deconstructs and camel-cases it to automatically save the ID (e.g. `programId`, `bloodGroupId`) to your environment variables, making chaining requests (Create -> Get -> Update -> Delete) fully automated!
