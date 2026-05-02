# Branch Module

The Branch module represents the actual operational units (Schools/Colleges) within an organization.

## Features
- **Hierarchical Structure**: Each branch must belong to a parent Organization.
- **Operational Details**: Stores branch name, logo, contact info, and physical address.
- **Structure Modes**: Supports `DEFAULT` and `CUSTOM` structure modes for future flexibility.
- **Status Management**: Support for enabling/disabling (`isActive`) and soft deletion (`isDeleted`).
- **Hierarchy-Aware RBAC**: Implements a role hierarchy where higher roles inherit permissions from lower roles.

## Data Structure
- `organizationId`: String (FK to Organization)
- `name`: String
- `code`: String (Unique slug-safe lowercase)
- `logoUrl`: String (Optional)
- `contactEmail`: String
- `contactPhone`: String
- `address`: Line1, Line2, City, State, Country, Pincode
- `structureMode`: DEFAULT, CUSTOM
- `isActive`: Boolean
- `isDeleted`: Boolean

## API Endpoints
- `POST /v1/branches`: Create a new branch.
- `GET /v1/branches`: List all active branches.
- `GET /v1/branches/:id`: Get specific branch details.
- `GET /v1/branches/organization/:orgId`: Get all branches for a specific organization.
- `PATCH /v1/branches/:id`: Update branch details.
- `DELETE /v1/branches/:id`: Soft delete a branch.
- `PATCH /v1/branches/:id/status`: Toggle branch active status.

## Role Hierarchy & Access
The system uses a weighted hierarchy:
`SUPER_ADMIN (5) > ORG_ADMIN (4) > BRANCH_ADMIN (3) > STAFF (2) > STUDENT/PARENT (1)`

- **CREATE**: SUPER_ADMIN, ORG_ADMIN
- **UPDATE**: SUPER_ADMIN, ORG_ADMIN
- **DELETE**: SUPER_ADMIN only
- **GET**: All roles
- **TOGGLE STATUS**: SUPER_ADMIN, ORG_ADMIN
