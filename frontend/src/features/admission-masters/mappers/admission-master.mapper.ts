import type { AdmissionMasterFormValues } from "../schemas/admission-master.schema";
import type {
  AdmissionMasterDto,
  AdmissionMasterRequest,
} from "../types/admission-master.dto";

/**
 * The only translation between the admission master form and the wire.
 *
 * **The body is always complete.** The Postman Create and Update requests are
 * identical, and no partial-update rule is documented, so an edit — and the
 * activate/deactivate action, which has no dedicated endpoint of its own —
 * both resend the whole record.
 *
 * `metadata` is never collected from the form (see the module `index.ts`), so
 * it is carried through unchanged from the loaded record on edit, and sent as
 * an empty object on create — matching the Postman example's type, not a
 * guessed default value.
 */

/** Seed the form from a loaded record. */
export function toAdmissionMasterFormValues(
  master: AdmissionMasterDto,
): AdmissionMasterFormValues {
  return {
    code: master.code,
    name: master.name,
    description: master.description ?? "",
    displayOrder: master.displayOrder,
    isActive: master.isActive,
  };
}

/**
 * Form values → the complete documented request body.
 *
 * `source` is the record being edited (omitted on create), so its `metadata`
 * survives an edit untouched instead of being overwritten with `{}`.
 */
export function toAdmissionMasterRequest(
  values: AdmissionMasterFormValues,
  source?: AdmissionMasterDto | null,
): AdmissionMasterRequest {
  const trimmedDescription = values.description.trim();

  return {
    code: values.code,
    name: values.name,
    description: trimmedDescription.length > 0 ? trimmedDescription : null,
    displayOrder: values.displayOrder,
    isActive: values.isActive,
    metadata: source?.metadata ?? {},
  };
}

/** The complete request body with `isActive` flipped — for activate/deactivate. */
export function toAdmissionMasterToggleRequest(
  master: AdmissionMasterDto,
): AdmissionMasterRequest {
  return {
    code: master.code,
    name: master.name,
    description: master.description,
    displayOrder: master.displayOrder,
    isActive: !master.isActive,
    metadata: master.metadata,
  };
}
