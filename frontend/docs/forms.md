# Forms

React Hook Form + Zod, wired through `components/form`.

## Building a form

```tsx
"use client";
import {
  Form,
  TextField,
  useZodForm,
  applyServerFieldErrors,
} from "@/components/form";
import { z } from "zod";
import { nonEmptyString, emailSchema } from "@/schemas";

const schema = z.object({ name: nonEmptyString, email: emailSchema });

export function ProfileForm() {
  const form = useZodForm(schema, { defaultValues: { name: "", email: "" } });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await save(values); // values are the validated, transformed output type
    } catch (error) {
      applyServerFieldErrors(error, form.setError); // maps API field errors
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-4">
        <TextField control={form.control} name="name" label="Name" />
        <TextField
          control={form.control}
          name="email"
          label="Email"
          type="email"
        />
        <button type="submit" disabled={form.formState.isSubmitting}>
          Save
        </button>
      </form>
    </Form>
  );
}
```

## Pieces

- **`useZodForm(schema, props)`** — `useForm` pre-wired with `zodResolver`.
  Input type drives fields; `handleSubmit` receives the transformed output type.
- **Field wrappers** (`components/form/fields`) — bind label, control,
  description, and validation message with correct a11y ids. Add more wrappers
  (`SelectField`, `DateField`, …) following the same pattern.

  | Wrapper         | Notes                                                                                                                                                |
  | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `TextField`     | Text/email/etc. Optional `startIcon` (decorative, `aria-hidden`), `labelAction` (node on the label row's trailing edge), `inputClassName` (density). |
  | `PasswordField` | Same options, plus an accessible show/hide toggle: action-phrased `aria-label`, `aria-pressed`, and a hidden live region announcing the change.      |
  | `CheckboxField` | Boolean control; Radix wires the label so clicking the text toggles it.                                                                              |

- **`applyServerFieldErrors`** — bridges normalized API `fieldErrors` into RHF.
- **Primitives** (`components/ui/form.tsx`) — shadcn `Form*` components adapted to
  the unified `radix-ui` package; wrappers compose these.

## Validation helpers

Shared schemas in `schemas/` (`idSchema`, `emailSchema`, `nonEmptyString`,
`paginationParamsSchema`) are composed by feature schemas so validation stays DRY.
