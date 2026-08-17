import type { ModuleFormValues } from "../schemas/module.schema";
import type { CreateModuleRequest, ModuleDto } from "../types/module.dto";

/** Seed the form from a loaded module. */
export function toModuleFormValues(module: ModuleDto): ModuleFormValues {
  return {
    code: module.code,
    name: module.name,
    description: module.description ?? "",
    icon: module.icon ?? "",
    displayOrder: module.displayOrder,
  };
}

/**
 * Build the request body. Optional fields collapse empty strings to `undefined`
 * rather than sending them — `description`/`icon` are documented optional, and
 * an empty string is not the same absence.
 */
export function toModuleRequest(values: ModuleFormValues): CreateModuleRequest {
  return {
    code: values.code,
    name: values.name,
    description: values.description || undefined,
    icon: values.icon || undefined,
    displayOrder: values.displayOrder,
  };
}
