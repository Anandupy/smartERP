/**
 * Public surface of the example feature. Outside code imports ONLY from here.
 * Copy this module to bootstrap a real ERP feature (students, fees, …).
 */
export {
  useExample,
  useExamples,
  useCreateExample,
} from "./hooks/use-examples";
export { exampleKeys } from "./api/example.keys";
export { exampleService } from "./api/example.service";
export {
  exampleFormSchema,
  type ExampleFormValues,
} from "./schemas/example.schema";
export type { ExampleEntity } from "./types";
