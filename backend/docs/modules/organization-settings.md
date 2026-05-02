# Organization Module

The Organization module handles multi-tenancy by managing different clients (Trusts/Groups) within the ERP system.

## Features
- **Identity Management**: Stores organization name, logo, and unique code.
- **Contact Info**: Stores primary contact email and phone.
- **Address Details**: Full physical address including city, state, country, and pincode.
- **Subscription Lifecycle**: Tracks `masterExpiryDate` and `status` (ACTIVE, INACTIVE, SUSPENDED).
- **Soft Delete**: Organizations are marked as `INACTIVE` instead of being permanently removed.
- **RBAC Protected**: Access is restricted based on user roles.

## Data Structure
- `name`: String
- `code`: String (Unique slug-safe lowercase)
- `logoUrl`: String (Optional)
- `contactEmail`: String
- `contactPhone`: String
- `address`: Line1, Line2, City, State, Country, Pincode
- `masterExpiryDate`: DateTime
- `status`: ACTIVE, INACTIVE, SUSPENDED
- `timezone`: String
- `currency`: String

## API Endpoints
- `POST /v1/organizations`: Create a new organization.
- `GET /v1/organizations`: List all active organizations.
- `GET /v1/organizations/:id`: Get specific organization details.
- `PATCH /v1/organizations/:id`: Update organization details.
- `DELETE /v1/organizations/:id`: Deactivate (soft delete) an organization.

## Role Access
- **SUPER_ADMIN**: Full access to all operations.
- **ORG_ADMIN**: Read and Update access only.
- **Others**: No access.
