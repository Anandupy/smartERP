import { createResourceService } from "@/services";

import type { ExampleEntity } from "../types";
import type { ExampleFormValues } from "../schemas/example.schema";

/**
 * Transport service for the example resource. `createResourceService` provides
 * typed CRUD against `/examples`; add feature-specific calls below as needed.
 */
export const exampleService = createResourceService<
  ExampleEntity,
  ExampleFormValues
>("/examples");
