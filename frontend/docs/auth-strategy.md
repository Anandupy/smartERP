# EduOS — Authentication Strategy

## Token Storage Design

The auth system is built behind a **TokenService abstraction layer** so storage can be migrated without touching application code.

### Current Implementation

| Token | Storage | Reason |
|---|---|---|
| Access Token | Zustand (in-memory) | Not persisted. Lost on tab close / refresh. |
| Refresh Token | localStorage | Survives tab close. Allows silent re-auth on boot. |

### Why Not HttpOnly Cookies?
The backend's refresh token endpoint (`POST /v1/auth/refresh`) accepts the refresh token in the request **body**, not via cookie. The backend is read-only per project rules. HttpOnly cookies would require a backend change.

### Migration Path
To migrate to HttpOnly cookies later:
1. Update `TokenService` only — no other files change
2. Backend sets `Set-Cookie` on login/refresh
3. TokenService reads from cookie instead of localStorage
4. All consuming code is unchanged

---

## TokenService Abstraction

`src/lib/api/token-service.ts` is the single point of truth for token operations.

```typescript
interface ITokenService {
  getAccessToken(): string | null;
  setAccessToken(token: string): void;
  clearAccessToken(): void;
  getRefreshToken(): string | null;
  setRefreshToken(token: string): void;
  clearRefreshToken(): void;
  clearAll(): void;
}
```

**No other file directly touches localStorage or Zustand for tokens.**

---

## Authentication Flow

### Login
1. User submits `{ identifier, password }` to `POST /v1/auth/login`
2. Backend returns `{ accessToken, refreshToken }`
3. `TokenService.setAccessToken(accessToken)` — stored in Zustand
4. `TokenService.setRefreshToken(refreshToken)` — stored in localStorage
5. JWT decoded → user data extracted → written to auth store
6. Role-based redirect via `getDefaultRedirect(role)`

### Request Lifecycle
1. Axios request interceptor reads `TokenService.getAccessToken()`
2. Injects `Authorization: Bearer <token>` header
3. Also injects `x-organization-id` and `x-branch-id` from context store

### Silent Token Refresh (401 handling)
1. Axios response interceptor catches 401
2. If `_retry` flag not set, attempts refresh
3. Calls `POST /v1/auth/refresh` with stored refresh token
4. On success: updates access token, retries original request
5. On failure: clears all tokens, redirects to `/login`

### Logout
1. Calls `POST /v1/auth/logout` with refresh token
2. `TokenService.clearAll()` — clears both tokens
3. Auth store cleared
4. Context store cleared
5. Redirect to `/login`

---

## Route Protection

### Middleware (`middleware.ts`)
- Runs on every request at the Edge
- Checks for access token presence in memory (cookie fallback for middleware)
- Redirects unauthenticated users from `(dashboard)/*` to `/login`
- Redirects authenticated users from `(auth)/*` to `/dashboard`

### AuthGuard Component
Client-side guard in `(dashboard)/layout.tsx`:
- Reads `isAuthenticated` from Zustand auth store
- Shows loading state during hydration
- Redirects to `/login` if not authenticated after hydration

---

## Security Considerations

- Access tokens are **never written to localStorage or sessionStorage**
- Refresh tokens in localStorage are XSS-accessible — acceptable tradeoff for ERP context
- Account lockout is backend-enforced (5 failed attempts → 10-minute lock)
- Session management: users can view and revoke individual sessions via `/profile/sessions`
- All API requests go over HTTPS in production

---

## Hydration Safety

The auth store uses Zustand's `persist` middleware with a `partialize` function that **excludes** the access token from persistence. Only non-sensitive UI state persists. The `onRehydrateStorage` callback triggers a silent token refresh on app boot if a refresh token exists.
