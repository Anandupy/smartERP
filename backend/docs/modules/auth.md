# Authentication & Identity Module

The Auth module handles user identification, authentication via JWT, and secure session management using refresh tokens.

## Architecture
- **JWT Based**: Uses short-lived Access Tokens (15m) and long-lived Refresh Tokens (7d).
- **Refresh Tokens**: Stored in the database and can be revoked upon logout.
- **Password Security**: Uses Bcrypt with a work factor of 12. Abstracted via `PasswordService` to allow future migration to Argon2.
- **Account Protection**: Implements a brute-force protection mechanism (lock account for 10m after 5 failed attempts).

## User Identity
The `User` model represents an authentication identity. It is decoupled from business logic.
- `username`, `email`, `phone`: All act as unique identifiers for login.
- `role`: RoleType enum determines system-wide permissions.

## Flow Diagrams

### Login Flow
1. User provides `identifier` (email/username/phone) and `password`.
2. System checks if account is locked.
3. System verifies password hash.
4. On success: Generate JWT + Refresh Token.
5. On failure: Increment `failedLoginAttempts`.

### Token Refresh Flow
1. Client sends `refreshToken`.
2. System verifies token existence and revocation status.
3. If valid: Issue new Access Token + new Refresh Token (Token Rotation).

## API Endpoints

### Auth Endpoints
- `POST /v1/auth/login`: Authenticate and receive tokens.
- `POST /v1/auth/refresh`: Exchange refresh token for new access token.
- `POST /v1/auth/logout`: Revoke refresh token.

### User Endpoints
- `POST /v1/users`: Create a new user (Admin only).
- `GET /v1/users/:id`: Get user details.
- `PATCH /v1/users/:id`: Update user details.

## Role Based Access Control (RBAC)
The system uses a weighted role hierarchy:
`SUPER_ADMIN > ORG_ADMIN > BRANCH_ADMIN > STAFF > STUDENT/PARENT`

The `RolesGuard` extracts the role from the JWT payload and validates against the required roles for an endpoint, accounting for hierarchy.
