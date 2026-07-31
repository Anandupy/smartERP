import { z } from "zod";

import { nonEmptyString } from "@/schemas";

/** Example form schema. Compose shared field schemas from `@/schemas`. */
export const exampleFormSchema = z.object({
  name: nonEmptyString,
});

export type ExampleFormValues = z.infer<typeof exampleFormSchema>;
