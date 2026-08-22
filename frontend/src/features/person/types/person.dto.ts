/**
 * Wire shape for `GET /v1/persons/:id` — "Read an Identity Record".
 *
 * Confirmed directly against `backend/postman/erp.postman_collection.json`'s
 * "Person / Person / Read an Identity Record" example and
 * `backend/docs/planning/01-identity-core/01-person.md` (design spec,
 * `Status: planned`).
 *
 * Person deliberately carries **no display attributes** — no name, no
 * contact, no address (design spec §1, "the sprawl rule"). Those live on
 * `Applicant`/`Student`/`Guardian`, which legitimately diverge from each
 * other over time. Person answers exactly one question: "is this the same
 * human?" — so this DTO is only ever rendered as an *identity/verification*
 * panel, never as a name/contact card.
 */
export interface PersonDto {
  id: string;
  organizationId: string;
  dob: string;
  /** Server-masked — never the raw government id. */
  governmentIdMasked: string | null;
  governmentIdErased: boolean;
  /** e.g. `"AADHAAR"`. */
  governmentIdType: string | null;
  /** Non-null means this row is a tombstone — merged into another Person. */
  mergedIntoPersonId: string | null;
  createdAt: string;
}
