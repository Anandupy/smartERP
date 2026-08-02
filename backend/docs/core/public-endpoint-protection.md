# Public Endpoint Protection

Unauthenticated endpoints are the only ones an anonymous caller can reach in
volume, so they are where credential stuffing, brute force and OTP abuse
actually happen. This document describes the rate limiting applied to them.

**No Redis.** Storage is an in-process `Map` from `@nestjs/throttler`'s default
provider. The application runs without any external cache — see §6 for what
that implies.

---

## 1. Scope: public routes only

`PublicRouteThrottlerGuard` is registered globally but skips any route that is
not `@Public()`.

Authenticated callers are deliberately exempt. They are already identified,
already authorized, and already accountable through the audit log; throttling
them turns an ordinary busy client into a support incident without adding
protection. Abuse by an authenticated user is a permissions problem, not a rate
problem.

The guard is registered **first** in the pipeline, so an abusive caller is
rejected before any database work happens.

---

## 2. Buckets

Four named buckets, all configured in seconds via the environment:

| Bucket           | Env                               | Default   | Applies to                                                                    |
| :--------------- | :-------------------------------- | :-------- | :---------------------------------------------------------------------------- |
| `default`        | `THROTTLE_TTL` / `THROTTLE_LIMIT` | 120 / 60s | Every public route, as a floor                                                |
| `auth`           | `THROTTLE_AUTH_*`                 | 10 / 300s | `POST /auth/login`, `POST /auth/refresh`                                      |
| `otp`            | `THROTTLE_OTP_*`                  | 5 / 300s  | `send-otp`, `verify-otp`, `resend-otp`, `verify-email`, `resend-verification` |
| `password-reset` | `THROTTLE_PASSWORD_RESET_*`       | 5 / 900s  | `forgot-password`, `reset-password`                                           |

Buckets are evaluated independently. A route carrying
`@Throttle({ [THROTTLE_BUCKET.AUTH]: {} })` is limited by **both** `auth` and
`default`, so the general floor still applies.

`THROTTLE_ENABLED=false` disables the guard entirely. `.env.test` sets it so
that repeated runs of the auth suites do not exhaust a bucket.

---

## 3. What each attack needs

IP-based limiting alone only catches one of the two shapes, so the tracker
combines the source address with the account being targeted:

```text
tracker = <ip>            when the request names no account
tracker = <ip>|<hash>     when it does
```

| Attack                  | Shape                          | Caught by                                                      |
| :---------------------- | :----------------------------- | :------------------------------------------------------------- |
| Credential stuffing     | Many accounts, one IP          | The IP component — every attempt shares a bucket               |
| Distributed brute force | One account, many IPs          | The account component — stable across the attacker's addresses |
| OTP guessing            | One account, repeated codes    | The `otp` bucket, keyed per account                            |
| Password-reset flooding | One address, repeated requests | The `password-reset` bucket                                    |

The account is read from `identifier`, `email` or `phone` in the request body,
normalised (trimmed, lower-cased) so the same account always lands in the same
bucket, and hashed before it becomes part of the key — throttler keys surface in
logs and error paths, and credentials should not.

The hash is non-cryptographic and deliberately short. It only has to bucket
requests; it is not protecting a secret.

---

## 4. Client address and `TRUST_PROXY`

Behind a reverse proxy, `req.ip` is the proxy's address, which would put every
caller in the world into a single bucket.

`TRUST_PROXY=true` makes Express read the client address from
`X-Forwarded-For`. It is **off by default**, because trusting that header when
nothing strips it lets a client forge its own source address and defeat
IP-based limiting entirely.

Enable it only when the application sits behind a proxy you control.

---

## 5. Response

Exceeding a limit returns HTTP **429**:

```json
{ "statusCode": 429, "message": "Too many requests. Please try again later." }
```

The message is deliberately generic. Reporting which bucket was exhausted, or
how long remains, tells an attacker how the limits are shaped.

---

## 6. Limits are per instance

In-memory storage means each application instance counts independently. Behind
a load balancer running N instances, the effective limit is up to N times the
configured value.

This is a deliberate trade-off given the no-Redis constraint. It is acceptable
because:

- The limits are already conservative relative to legitimate use.
- Rate limiting here is defence in depth, not the primary control — OTPs expire,
  reset tokens are single-use, and passwords are bcrypt-hashed.

If the deployment scales horizontally and stricter global limits become
necessary, the change is confined to `ThrottlingModule`: supply a shared
`ThrottlerStorage` implementation. Nothing else in the codebase depends on the
storage being in-process.

---

## 7. Adding a public route

1. Mark it `@Public()` — this alone gives it the `default` bucket.
2. If it handles credentials, OTPs or reset tokens, add the matching
   `@Throttle({ [THROTTLE_BUCKET.X]: {} })`.
3. If it introduces a new class of abuse, add a bucket to
   `src/common/throttling/throttler.config.ts`, declare its variables in
   `src/config/env.validation.ts` and `.env.example`, and document it in §2.
