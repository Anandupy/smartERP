# S2 — Address

> **Status:** `planned` — §10 has two open questions
> **Depends on:** I1 (Person)
> **Depended on by:** transport routing, certificates, invoices, communication, government reporting

**New module.** No `Address` entity exists. Addresses are inline columns on
`Applicant` (`schema.prisma:185–191`) and `Guardian` (`:323–329`).

---

## 1. Purpose

S2 owns **where a person can be found** — the current, permanent, communication
and billing addresses of a living person, and the history of how those changed.

It does **not** own the address **declared on an application form**. That stays
exactly where it is, inline on `Applicant`, and is never migrated.

### Two things called "address" that must not share a model

| | Applicant's inline address | S2 `Address` |
| :--- | :--- | :--- |
| What it is | A legal snapshot of what was declared on a date | Where the person actually lives now |
| Changes? | **Never** | Whenever they move |
| Owner | `Applicant` | `Person` |
| Purpose | Evidence | Operations |

If a family moves in 2029, the 2026 application form must still show the 2026
address. Merging these would make that impossible — the same reasoning that
keeps Student's demographics separate from Applicant's.

---

## 2. Decisions

| # | Decision | Why |
| :--- | :--- | :--- |
| D1 | **`Address` is an immutable value object; `PersonAddress` links it to a person with a type and a validity window** | See §2.1 — this is what gives sharing and history simultaneously. |
| D2 | **Addresses attach to `Person`, not to Student or Guardian** | A human has an address regardless of role. Attaching per role would duplicate it for a parent who is also an alumnus. |
| D3 | **Four types: `PERMANENT`, `CURRENT`, `COMMUNICATION`, `BILLING`** | §8 Q5–Q8. `COMMUNICATION` falls back to `CURRENT`; `BILLING` resolves from the financial guardian. |
| D4 | **No `Household` entity** | §7 Q12, §8 Q3. Sharing is achieved by two people referencing one `Address` row — which is all a household would have provided here. |
| D5 | **PIN code drives district and state, from a seeded table** | §8 Q11. The single largest source of dirty address data in Indian school records is hand-typed district names. |
| D6 | **Geo coordinates are optional and never required at admission** | §8 Q10. A mandatory field staff cannot fill gets filled with garbage. Transport requires it; admission does not. |
| D7 | **`countryCode` (ISO 3166-1 alpha-2), defaulting to `IN`** | §1 Q5 — international expansion should be configuration, not redesign. |

### 2.1 Why Address is immutable

The obvious design gives each person an address row and edits it when they move.
That loses history, and §8 Q13 requires history — a Transfer Certificate issued
in 2031 must print the address as it was when issued, not as it is now.

The alternative — versioning rows in place — breaks sharing, because two
siblings pointing at one row cannot have independent histories.

So:

- **`Address`** is the *place*. Immutable. Once written, never edited.
- **`PersonAddress`** is *this person lived there, as this type, from then until
  then*. Append-only.

A family moving creates **one** new `Address` and closes/opens a link per family
member. Correcting a typo also creates a new `Address` — which is correct, since
you cannot tell a typo from a move after the fact, and the old value may already
be printed on a certificate.

Identical addresses are de-duplicated on a normalised hash, so a family of four
shares one row rather than four.

---

## 3. Data model

### 3.1 `Address` — immutable

| Field | Type | Null | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID v7` | no | |
| `organizationId` | `String` | no | Tenant isolation; also scopes de-duplication |
| `line1` | `String` | no | |
| `line2` | `String?` | yes | |
| `landmark` | `String?` | yes | Load-bearing in Indian addressing |
| `city` | `String` | no | |
| `district` | `String?` | yes | Auto-filled from PIN (D5) |
| `state` | `String` | no | Auto-filled from PIN |
| `countryCode` | `String` | no | Default `IN` (D7) |
| `pincode` | `String` | no | |
| `latitude` / `longitude` | `Decimal?` | yes | D6 |
| `normalizedHash` | `String` | no | De-duplication key |
| `createdAt` | `DateTime` | no | **No `updatedAt` — the row never changes** |

### 3.2 `PersonAddress` — append-only

| Field | Type | Notes |
| :--- | :--- | :--- |
| `id` | `UUID v7` | |
| `personId` | `String` | |
| `addressId` | `String` | |
| `addressType` | `AddressType` | `PERMANENT`, `CURRENT`, `COMMUNICATION`, `BILLING` |
| `validFrom` | `DateTime` | |
| `validTo` | `DateTime?` | Null = current |
| `verificationStatus` | `VerificationStatus` | `UNVERIFIED`, `VERIFIED`, `REJECTED` |
| `verifiedBy` / `verifiedAt` | `String?` / `DateTime?` | |
| `proofDocumentId` | `String?` | S3 |
| `changeReason` | `String?` | |

### 3.3 `PincodeReference` — seeded

`pincode` (PK), `district`, `state`, `countryCode`. Seeded from India Post data,
refreshable. Used to auto-fill and to validate, **never to block** — new PIN
codes are issued and the reference will always lag.

### 3.4 Resolution

```
resolveAddress(personId, type, asOf = now)
  1. PersonAddress of exactly `type`, valid at asOf
  2. COMMUNICATION → fall back to CURRENT
  3. BILLING → resolve from the ward's financial guardian (S1), then their CURRENT
  4. else null
```

Step 3 is why `BILLING` is rarely set directly: the bill goes to whoever pays,
which S1 already records.

---

## 4. Invariants

| # | Invariant | Mechanism |
| :--- | :--- | :--- |
| 1 | One current address per person per type | `CREATE UNIQUE INDEX person_address_current ON "PersonAddress" ("personId","addressType") WHERE "validTo" IS NULL` |
| 2 | No overlapping windows per person per type | Exclusion constraint over `tstzrange("validFrom","validTo")` — same `btree_gist` requirement as F2 invariant 5 |
| 3 | A closed window is ordered | `CHECK ("validTo" IS NULL OR "validFrom" < "validTo")` |
| 4 | Addresses de-duplicate within a tenant | `@@unique([organizationId, normalizedHash])` |
| 5 | `Address` is never updated | No update path in the service; `REVOKE UPDATE` on the table role |
| 6 | Pincode is well-formed | `CHECK (("countryCode" <> 'IN') OR "pincode" ~ '^[1-9][0-9]{5}$')` — Indian PINs never start with zero |

Invariant 5 is the one that makes history trustworthy. If any code path can edit
an `Address`, every historical `PersonAddress` silently starts pointing at the
new value, and certificates printed years ago retroactively change.

---

## 5. Provenance

Both tables are append-only. A move writes:

```
PersonAddress  addr-OLD  CURRENT  validFrom: 2024-06-01  validTo: 2027-03-15
PersonAddress  addr-NEW  CURRENT  validFrom: 2027-03-15  validTo: null
                                  changeReason: "family relocated to Thane"
```

### The correction test

A clerk mistypes a house number and fixes it an hour later. **This produces the
same shape as a move** — a new `Address` and a new link — because the system
cannot distinguish a correction from a relocation, and the wrong value may
already have been printed.

`changeReason` is what distinguishes them for a human reader. That is the
correct place for the distinction: a free-text reason a person wrote, not a flag
the system guessed.

---

## 6. Lifecycle

`Address`: created, never modified, never deleted (historical links depend on it).

`PersonAddress`: `UNVERIFIED → VERIFIED | REJECTED`, and separately open →
closed when superseded. Whether verification is required before enrollment is an
F2 configuration key, not a hard rule (§8 Q15).

---

## 7. API surface

| Method | Path | Purpose | Roles |
| :--- | :--- | :--- | :--- |
| `GET` | `/v1/persons/:id/addresses` | Current addresses by type | `STAFF`+ |
| `GET` | `/v1/persons/:id/addresses/history` | Full history | `BRANCH_ADMIN`+ |
| `PUT` | `/v1/persons/:id/addresses/:type` | Set — creates or reuses an `Address`, closes the previous link | `STAFF`+ |
| `POST` | `/v1/persons/:id/addresses/:type/verify` | Record verification | `BRANCH_ADMIN`+ |
| `GET` | `/v1/pincodes/:pincode` | Lookup district and state | `STAFF`+ |

**No `POST /v1/addresses`** — an `Address` is only ever created as part of
assigning one to a person. A free-floating address with no resident is noise.

**No `DELETE`** — clearing a type closes the link; it does not remove history.

| Rule broken | Status | `error.code` |
| :--- | :--- | :--- |
| Malformed Indian pincode | `400` | `BadRequestException` |
| `validFrom` before the current window's start | `409` | `ConflictException` — would create an overlap |
| Unknown pincode in the reference | `200` with a warning | Never blocks (D5) |

---

## 8. Events

| Event | When | Consumers |
| :--- | :--- | :--- |
| `address.assigned` | A person gets a new address of a type | Transport (re-route), communication |
| `address.verified` | Verification recorded | Admissions checklist |

`address.assigned` for a `CURRENT` type is what transport must consume — a
student who moves may fall outside their existing bus route, and nobody will
tell the transport office.

---

## 9. Dependencies

**Requires:** I1 (Person), `btree_gist`, seeded pincode data.

**Depended on by:** transport routing, certificates and TC, GST invoices
(billing address), communication (postal), government reporting.

### Migration

1. Create `Address` and `PersonAddress`
2. **Backfill from `Guardian`'s address columns** — these are current-address
   facts about a living person and belong in S2
3. **Do NOT migrate `Applicant`'s inline address.** It stays as the frozen
   snapshot (§1). Instead, seed each applicant's Person a `CURRENT` address
   *copied from* the application at admission time.
4. Drop the `Guardian` address columns
5. Seed `PincodeReference`

Step 3 is the one to get right: migrating the applicant columns would delete the
legal record of what was declared.

---

## 10. Open questions

| # | Question | Blocks | Options |
| :--- | :--- | :--- | :--- |
| **Q1** | **Where does India Post PIN data come from, and how is it refreshed?** | D5, invariant 6 | Roughly 19,000 PIN codes exist and new ones are issued. Options: (a) seed a static snapshot and refresh manually per release — simple, goes stale, acceptable because unknown PINs warn rather than block; (b) call an external API at entry — always current, but adds a network dependency to a form field and fails offline. **Recommendation: (a).** Needs a decision on where the dataset is sourced and how often it is refreshed. |
| **Q2** | **Should an address change require verification before it takes effect?** | The `PUT` endpoint | A parent updating their address in a portal could redirect a Transfer Certificate. Options: (a) staff-only writes; (b) parent may propose, staff approves; (c) immediate, with audit. **Recommendation: (b)** for portal-originated changes, (c) for staff-originated. Needs confirmation once the parent portal is scoped. |

---

## 11. Acceptance scenarios

| # | Scenario | Expected |
| :--- | :--- | :--- |
| 1 | Family of four at one address | **One** `Address` row, four `PersonAddress` links (D1, invariant 4) |
| 2 | Family moves | One new `Address`; four links closed and four opened; **old address still readable** |
| 3 | TC issued in 2031 for an address held in 2026 | Prints the **2026** address (invariant 5) |
| 4 | Typo corrected an hour later | Same shape as a move; `changeReason` distinguishes it |
| 5 | Applicant's inline address after the person moves | **Unchanged** — the form still reads as filed (§1) |
| 6 | Enter pincode `400607` | District and state auto-filled from the reference |
| 7 | Enter an unrecognised pincode | **Accepted with a warning**, never blocked (D5) |
| 8 | Enter pincode `012345` | Rejected — Indian PINs never start with zero (invariant 6) |
| 9 | Resolve `COMMUNICATION` when none is set | Falls back to `CURRENT` (§3.4) |
| 10 | Resolve `BILLING` for a student | Financial guardian's address (§3.4 step 3, S1) |
| 11 | **Raw SQL**: two open `CURRENT` links for one person | Rejected (invariant 1) |
| 12 | **Raw SQL**: overlapping windows for one person and type | Rejected (invariant 2) |
| 13 | **Raw SQL**: `UPDATE` an `Address` row | Rejected — no grant (invariant 5) |

Scenario 3 is the one the immutability decision exists for. 11–13 must run as
raw SQL.
