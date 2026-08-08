# Key Custody

What the application holds, what it must never hold, and the one decision that
is still outstanding.

> **Status: recovery custody is NOT established.** The code path exists and is
> tested; the ceremony that produces the keypair has not been run. Until it has,
> this deployment cannot store sensitive identity data in production — by
> design, and enforced at boot. §5 is what remains to be done.

---

## 1. The three secrets

| Variable | What it is | Where it lives | Consumed by |
| :--- | :--- | :--- | :--- |
| `ENCRYPTION_KEY` | Symmetric **operational KEK**. Wraps each organization's data key. | Server environment | `EnvOperationalKeyProvider` |
| `IDENTITY_HASH_PEPPER` | HMAC key for identity blind indexes. | Server environment | `IdentityHashService` |
| `KEK_RECOVERY_PUBLIC_KEY` | **Public half** of the recovery keypair. | Server environment — it is not a secret | `EnvRecoveryKeyProvider` |
| *(the recovery private key)* | **Break-glass.** Unwraps a data key when the operational key is lost. | **Offline. Never on a server.** | Nothing. There is no code path. |

`docs/core/configuration.md` §5 previously recorded `ENCRYPTION_KEY` as
"reserved, not yet consumed" and stated that no sensitive value was stored.
Phase 1 makes both statements false.

---

## 2. Why the recovery key is asymmetric

The requirement is that a full server compromise must not cost you the recovery
path. A second symmetric key sitting beside the first fails that immediately:
whoever reads one reads both.

So recovery uses a keypair, and the server holds only the public half.
Encryption needs nothing else — the server can produce a recovery wrap it is
itself unable to undo.

```
                 ENCRYPTION_KEY                KEK_RECOVERY_PUBLIC_KEY
              (symmetric, on server)        (public half, on server, not secret)
                        │                                │
                        ▼                                ▼
        ┌───────────────────────────────────────────────────────────┐
        │  OrganizationDataKey                                       │
        │    dekWrappedOperational          dekWrappedRecovery       │
        └───────────────────────────────────────────────────────────┘
                        │  either wrap yields the same DEK
                        ▼
                  DEK (32 bytes, in process memory only, never stored)
                        │
                        ▼
             encrypts PersonSensitive.aadhaarEnc
```

Unwrapping the recovery side requires the private half, which exists only
offline. That is a deliberate absence, not an omission: a server able to perform
recovery is a server an attacker can make perform recovery.

---

## 3. What the application enforces today

| Condition | Development | Production |
| :--- | :--- | :--- |
| `ENCRYPTION_KEY` absent | Warns at boot; any operation needing it is refused | **Refuses to start** |
| `ENCRYPTION_KEY` not 32 bytes (base64 / base64url / hex) | **Refuses to start** | **Refuses to start** |
| `IDENTITY_HASH_PEPPER` absent | Warns at boot; matching is refused | **Refuses to start** |
| `IDENTITY_HASH_PEPPER` equals `ENCRYPTION_KEY` | **Refuses to start** | **Refuses to start** |
| `KEK_RECOVERY_PUBLIC_KEY` absent | Warns; data keys are `PENDING_RECOVERY_CUSTODY` | **Refuses to start** |
| `KEK_RECOVERY_PUBLIC_KEY` contains a PRIVATE key | **Refuses to start** | **Refuses to start** |
| A data key with no recovery wrap is used | Permitted, logged | **Refused at use** |

There is no fallback anywhere in that table. No default key, no plaintext path,
no `SHA256` substitute for the blind index. A misconfigured deployment fails
loudly rather than storing sensitive data in a form nobody intended.

`DataKeyStatus.PENDING_RECOVERY_CUSTODY` exists so the incomplete state has an
honest name. A key with one wrap is not `ACTIVE`, and a database `CHECK`
enforces that an `ACTIVE` key carries both.

---

## 4. Two secrets that can never change

**`IDENTITY_HASH_PEPPER`.** Changing it raises no error. Every existing blind
index silently stops matching, duplicate detection finds nobody, and
`resolve()` starts minting a second identity for every returning human. There is
no migration back: the old indexes cannot be recomputed without the old pepper
*and* the plaintext.

**The recovery private key.** Losing it removes the second wrap's value
entirely. Losing it *and* `ENCRYPTION_KEY` makes every tenant's sensitive data
permanently unreadable.

Treat both with the care of a root credential.

---

## 5. ⚠️ OUTSTANDING — the ceremony

This is the operational decision the application deliberately does not make for
you. It requires humans, and it must not be automated into the deployment.

1. **Generate the keypair on an offline machine.**

   ```bash
   openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:4096 -out recovery-private.pem
   openssl rsa -in recovery-private.pem -pubout -out recovery-public.pem
   ```

2. **Custody the private half.** Decide and write down: who holds it, where
   (hardware token, sealed envelope in a safe, split across two officers), who
   may authorise its use, and how its continued existence is checked. A private
   key nobody can find in an emergency is the same as no private key.

3. **Configure only the public half** as `KEK_RECOVERY_PUBLIC_KEY`.

4. **Destroy every copy of the private half that touched a networked machine**,
   including shell history and the file the generation command wrote if that
   machine was ever online.

5. **Re-wrap existing data keys.** Any key provisioned before this ran is
   `PENDING_RECOVERY_CUSTODY` and holds only the operational wrap. Re-wrapping
   is a `KEK_REWRAP`, recorded in `DataKeyRotationLog`.

6. **Rehearse the recovery.** An untested recovery path is a belief, not a
   control. Confirm the private half actually unwraps a
   `dekWrappedRecovery` **before** relying on it.

Steps 5 and 6 have no implementation yet — the re-wrap tool and the recovery
runbook are follow-up work, tracked with this document.

---

## 6. Generating the other two secrets

```bash
# ENCRYPTION_KEY — must decode to exactly 32 bytes
openssl rand -base64 32

# IDENTITY_HASH_PEPPER — length is not constrained, but generate real entropy
openssl rand -base64 48
```

Never commit either. `.env.example` carries placeholders only. The two must
differ: one disclosure should not cost both confidentiality and matching.

---

## 7. What is deliberately not built

| Not built | Why |
| :--- | :--- |
| Recovery **unwrap** in the application | It would require the private half on the server, defeating the entire mechanism |
| KEK rotation tooling | The abstraction and the version columns exist; the operator-facing tool is follow-up work |
| DEK rotation (re-encrypting a tenant's data) | Same |
| A reveal endpoint for a decrypted identifier | It ships with the access log that records who read what and why. Shipping the reveal first would create reads nobody can account for. |
| Tenant crypto-shred | `shreddedAt` and the status exist; the procedure that destroys both wraps is follow-up work |

Each of these is an absence with a reason, not an oversight. The interfaces are
shaped so none of them requires a schema change to add.
