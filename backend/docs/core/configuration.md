# Environment & Configuration Contract

CampusFlow ERP validates its entire environment **once, at process start**,
before the Nest application is created and before any provider is instantiated.
A misconfigured deployment fails loudly at boot rather than surfacing later as an
authentication bypass, a missing table, or a request silently served with a
fallback secret.

---

## 1. Where it lives

| File                            | Responsibility                                                                                        |
| :------------------------------ | :---------------------------------------------------------------------------------------------------- |
| `src/config/env.validation.ts`  | The contract. Declares every variable, its type, format and cross-field rules. Exports `validateEnv`. |
| `src/config/env.config.ts`      | Namespaced accessor (`env.*`) built from validated values. Contains **no** secret fallbacks.          |
| `src/config/database.config.ts` | Namespaced accessor (`database.url`).                                                                 |
| `.env.example`                  | Committed template. Documents every variable and how to generate secrets.                             |

`validateEnv` is wired as the `validate` hook of the global `ConfigModule`:

```typescript
ConfigModule.forRoot({
  isGlobal: true,
  load: [envConfig, databaseConfig],
  envFilePath: '.env',
  validate: validateEnv,
});
```

---

## 2. Startup failure behaviour

Every problem is collected and reported in a single message, so a broken
environment is fixed in one pass rather than one restart per variable:

```text
Invalid environment configuration — refusing to start:
  • DATABASE_URL is required
  • JWT_SECRET is required
  • PORT must be an integer

Fix the variables above in your .env file (see .env.example) and restart.
```

---

## 3. Variable reference

### Runtime

| Variable   | Required | Default       | Rules                                      |
| :--------- | :------- | :------------ | :----------------------------------------- |
| `NODE_ENV` | No       | `development` | One of `development`, `test`, `production` |
| `PORT`     | No       | `3000`        | Integer, 1–65535                           |

### Database

| Variable       | Required | Default | Rules                                       |
| :------------- | :------- | :------ | :------------------------------------------ |
| `DATABASE_URL` | **Yes**  | —       | Must match `postgresql://` or `postgres://` |

### Authentication

| Variable                 | Required | Default | Rules                                             |
| :----------------------- | :------- | :------ | :------------------------------------------------ |
| `JWT_SECRET`             | **Yes**  | —       | Not a known placeholder; ≥ 32 chars in production |
| `JWT_REFRESH_SECRET`     | **Yes**  | —       | Same rules; must differ from `JWT_SECRET`         |
| `JWT_EXPIRES_IN`         | No       | `15m`   | `<number><s\|m\|h\|d>`                            |
| `JWT_REFRESH_EXPIRES_IN` | No       | `7d`    | `<number><s\|m\|h\|d>`                            |
| `ENCRYPTION_KEY`         | No       | —       | ≥ 32 chars **when supplied**. Reserved; see §5    |

### Bootstrap seeding

| Variable            | Required    | Default | Rules                                     |
| :------------------ | :---------- | :------ | :---------------------------------------- |
| `SEED_ON_BOOTSTRAP` | No          | —       | Boolean. Must not be `true` in production |
| `ADMIN_EMAIL`       | Conditional | —       | Required when `SEED_ON_BOOTSTRAP=true`    |
| `ADMIN_PASSWORD`    | Conditional | —       | Required when `SEED_ON_BOOTSTRAP=true`    |

Seeding on boot is **opt-out** outside production: an unset variable still
seeds, which is the long-standing development behaviour.

In production the seeder never runs on boot, regardless of this variable —
automatic seeding would create a privileged account from environment
credentials on every deploy, and rewrite the permission and menu catalogues.
Seed a production database explicitly:

```bash
pnpm seed
```

Seeding is idempotent, so re-running it is safe.

### HTTP

| Variable       | Required          | Default | Rules                             |
| :------------- | :---------------- | :------ | :-------------------------------- |
| `CORS_ORIGINS` | **In production** | —       | Comma-separated origin allow-list |

### Throttling

All throttling is in-memory — **no Redis is required or used**.

| Variable                                    | Default      | Purpose                           |
| :------------------------------------------ | :----------- | :-------------------------------- |
| `THROTTLE_ENABLED`                          | `true`       | Master switch (tests set `false`) |
| `THROTTLE_TTL` / `THROTTLE_LIMIT`           | `60` / `120` | Global default bucket             |
| `THROTTLE_AUTH_TTL` / `THROTTLE_AUTH_LIMIT` | `300` / `10` | Credential endpoints              |
| `THROTTLE_OTP_TTL` / `THROTTLE_OTP_LIMIT`   | `300` / `5`  | OTP issue & verify                |
| `THROTTLE_PASSWORD_RESET_TTL` / `_LIMIT`    | `900` / `5`  | Password reset                    |

### Logging

| Variable    | Default      | Rules                                                     |
| :---------- | :----------- | :-------------------------------------------------------- |
| `LOG_LEVEL` | `info`       | One of `fatal`, `error`, `warn`, `info`, `debug`, `trace` |
| `LOG_DIR`   | `<cwd>/logs` | Directory for `app.log` / `error.log`                     |

---

## 4. Secret rules

### Rejected placeholder values

These are rejected outright, case-insensitively, in **every** environment. A
deployment holding one of them is functionally unauthenticated:

```text
default-secret   super-secret   super-refresh-secret   secret
changeme         change-me      your-secret-key        jwt-secret
test-secret
```

Two of these — `default-secret` and `super-secret` — were previously the
hard-coded fallbacks in `jwt.strategy.ts`, `auth.module.ts` and
`env.config.ts`. Those fallbacks have been removed; the code now uses
`ConfigService.getOrThrow`, and presence is guaranteed by validation.

### Length

Minimum 32 characters, enforced **in production only**. Shorter values are
tolerated in development and test so that local setup and fixtures stay
convenient, but a production deployment cannot start on a weak secret.

### Distinctness

`JWT_SECRET` and `JWT_REFRESH_SECRET` must differ. If they are equal, a refresh
token verifies as an access token.

### Generating a secret

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

---

## 5. `ENCRYPTION_KEY` — reserved, not yet consumed

**No sensitive value is currently stored in the database.** An audit of every
persisted field found nothing that needs encrypting today:

| Field                          | State                                                                                     |
| :----------------------------- | :---------------------------------------------------------------------------------------- |
| `RefreshToken.tokenHash`       | SHA-256, raw value never stored                                                           |
| `PasswordResetToken.tokenHash` | SHA-256                                                                                   |
| `OtpToken.otpHash`             | SHA-256                                                                                   |
| `User.passwordHash`            | bcrypt                                                                                    |
| `ProviderConfig.credentials`   | **Never written** — no code reads or writes it; the provider integration is unimplemented |
| `User.twoFactorSecret`         | **Never written** — two-factor authentication is unimplemented                            |

`ENCRYPTION_KEY` is therefore declared and format-checked, but deliberately
unused: there is nothing to encrypt, and an encryption service with no consumer
would be dead code.

> [!IMPORTANT]
> Two columns will need encryption **before their first write**, and both are
> marked in the schema:
>
> - `ProviderConfig.credentials` — SMTP passwords, API keys, provider secrets.
> - `User.twoFactorSecret` — a TOTP secret must be recoverable to verify a code,
>   so it cannot be hashed the way the token columns are.
>
> Use AES-256-GCM with `ENCRYPTION_KEY`, encrypt on write and decrypt on read so
> the API contract does not change, and never encrypt a column that is queried
> or indexed.

---

## 6. Test environment

`.env.test` disables the two behaviours that make tests non-deterministic:

```env
THROTTLE_ENABLED=false
SEED_ON_BOOTSTRAP=false
```

The test harness seeds explicitly through `test/setup/global-setup.ts`, so
bootstrap seeding would race with it. Rate limiting is disabled so that repeated
runs of the auth suites do not exhaust a bucket.

`.env.test` must also define `JWT_REFRESH_SECRET`; it is a required variable and
its absence now fails validation at boot.

---

## 7. Adding a new variable

1. Declare it on `EnvironmentVariables` in `src/config/env.validation.ts` with
   the appropriate `class-validator` decorators.
2. Add a cross-field or environment-sensitive rule to `collectSemanticErrors`
   if one applies.
3. Expose it through `src/config/env.config.ts` if application code reads it.
4. Document it in `.env.example` **and** in the reference table above.
5. Add a case to `test/unit/env.validation.spec.ts`.
