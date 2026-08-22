/**
 * Public surface of the Person module.
 *
 * Scope: `Person` — identity infrastructure, not a standalone concept.
 * Confirmed against `backend/postman/erp.postman_collection.json`'s
 * "Person / Person / Read an Identity Record" and
 * `backend/docs/planning/01-identity-core/01-person.md` (design spec).
 *
 * **Deliberately read-only and deliberately not surfaced in navigation.**
 * Person has no direct create API (design spec §2 D2 — it only ever exists
 * as a side effect of creating an Applicant, Guardian or Employee) and no
 * display attributes of its own (§1 "the sprawl rule" — name/contact/address
 * live on the role record, not here). This module exists to be *composed
 * into* Applicant/Guardian/Student screens as an identity-verification
 * panel, exactly as `backend/docs` describes it — never as its own
 * navigation destination.
 *
 * **Only the read endpoint is wired.** `POST /persons/match`,
 * `POST /persons/match-decisions`, `POST /persons/:id/government-id` and the
 * address sub-resource all exist in the collection but are out of this
 * module's current scope — duplicate-identity review and address management
 * are separate capabilities from "show identity status on a screen that
 * already has a person id," and building them here would be exactly the
 * "standalone Person module" the architecture explicitly avoids.
 */

export { PersonPanel, type PersonPanelProps } from "./components/person-panel";
export { personService } from "./api/person.service";
export { personKeys } from "./api/person.keys";
export { usePerson } from "./hooks/use-person";
export type { PersonDto } from "./types/person.dto";
