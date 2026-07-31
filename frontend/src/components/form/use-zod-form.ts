"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  useForm,
  type FieldValues,
  type Resolver,
  type UseFormProps,
  type UseFormReturn,
} from "react-hook-form";
import type { z } from "zod";

/**
 * `useForm` pre-wired with a Zod resolver. Callers pass a schema and get a fully
 * typed form whose input type drives the fields and whose output (transformed)
 * type is delivered to `handleSubmit`. This is the single entry point features
 * use to build validated forms.
 */
export function useZodForm<
  TOutput extends FieldValues,
  TInput extends FieldValues = TOutput,
>(
  schema: z.ZodType<TOutput, TInput>,
  props?: Omit<UseFormProps<TInput, unknown, TOutput>, "resolver">,
): UseFormReturn<TInput, unknown, TOutput> {
  return useForm<TInput, unknown, TOutput>({
    resolver: zodResolver(schema) as Resolver<TInput, unknown, TOutput>,
    ...props,
  });
}
