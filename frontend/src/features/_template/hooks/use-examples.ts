"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { invalidateKeys } from "@/core/query";
import type { PaginationParams } from "@/types/api";

import { exampleKeys } from "../api/example.keys";
import { exampleService } from "../api/example.service";
import type { ExampleFormValues } from "../schemas/example.schema";

/** Query the paginated example list. */
export function useExamples(params?: PaginationParams) {
  return useQuery({
    queryKey: exampleKeys.list(params),
    queryFn: () => exampleService.list(params),
  });
}

/** Query a single example by id. */
export function useExample(id: string) {
  return useQuery({
    queryKey: exampleKeys.detail(id),
    queryFn: () => exampleService.get(id),
    enabled: Boolean(id),
  });
}

/** Create an example and invalidate the list on success. */
export function useCreateExample() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: ExampleFormValues) => exampleService.create(values),
    onSuccess: () => invalidateKeys(queryClient, [exampleKeys.lists()]),
  });
}
