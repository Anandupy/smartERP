# Authentication & Identity Module

The Auth module handles user identification, authentication via JWT, and secure session management using refresh tokens.

## Architecture
- **JWT Based**: Uses short-lived Access Tokens (15m) and long-lived Refresh Tokens (7d).
- **Multi-Device Support**: Users can have multiple active sessions (different devices/browsers).
- **Secure Sessions**: Refresh tokens are hashed before being stored in the database.
- **Session Tracking**: IP address, user-agent, and device type are tracked for each session.
- **Password Security**: Uses Bcrypt with a work factor of 12. Abstracted via `PasswordService`.
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
4. On success:
   - Capture IP, User-Agent, and Device.
   - Generate JWT + Refresh Token.
   - Store hashed Refresh Token with session info.
5. On failure: Increment `failedLoginAttempts`.

### Token Refresh Flow (Rotation)
1. Client sends `refreshToken`.
2. System hashes the token and verifies existence and revocation status (with fallback for legacy tokens).
3. If valid:
   - Revoke the old token (set `isRevoked = true` and `revokedAt`).
   - Issue new Access Token + new Refresh Token (Hashed).
   - Maintain the original session information (IP, Device).

## Token Security
- **Hashing**: All new refresh tokens are hashed using SHA-256 before storage. The raw token is only sent to the client once.
- **Rotation**: Refresh tokens are rotated on every use, limiting the window of opportunity for stolen tokens.
- **Backward Compatibility**: Tokens created before the migration are still supported via the legacy `token` field.

## Session Management
Users can manage their active sessions via the following APIs:

### GET /v1/auth/me
Returns the authenticated user profile, assigned role, effective permissions, active execution context (`organizationId`, `branchId`, `academicYearId`), and available organizations, branches, and academic years for context selection.

### GET /v1/auth/sessions
Returns a list of active sessions for the authenticated user, including device info and IP address.

### DELETE /v1/auth/sessions/:id
Revokes a specific session by its ID.

### DELETE /v1/auth/sessions
Revokes all active sessions for the user (effectively a "logout from all devices").

## API Endpoints

### POST /v1/auth/login
- Public
- Body: `LoginDto`
- Response: `Tokens` + Session info

### POST /v1/auth/refresh
- Public
- Body: `{ refreshToken: string }`
- Response: New `Tokens`

### POST /v1/auth/logout
- Public (requires refreshToken)
- Query: `allDevices=true` (optional)
- Body: `{ refreshToken: string }`
- Response: Success message

### POST /v1/auth/change-password
- Authenticated (JWT)
- Body: `{ currentPassword: string, newPassword: string }` (`newPassword` min 8 chars)
- Verifies `currentPassword` against the account's stored hash — distinct from
  `POST /v1/auth/reset-password`, which verifies a single-use recovery token
  instead and requires no active session.
- Revokes every refresh token for the account on success (same effect as
  `reset-password`), so other devices are signed out. No per-session
  exclusion exists platform-wide, so the caller's own other sessions are
  revoked too; its current access token stays valid until it expires.
- Audited via the existing `communication.password_changed` event.
- Response: Success message

### User Endpoints
- `POST /v1/users`: Create a new user (Admin only).
- `GET /v1/users/:id`: Get user details.
- `PATCH /v1/users/:id`: Update user details.

## Role Based Access Control (RBAC)
The system uses a weighted role hierarchy:
`SUPER_ADMIN > ORG_ADMIN > BRANCH_ADMIN > STAFF > STUDENT/PARENT`

The `RolesGuard` extracts the role from the JWT payload and validates against the required roles for an endpoint, accounting for hierarchy.
