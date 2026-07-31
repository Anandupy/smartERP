import { api } from "@/core/api";
import type { ApiResponse, PaginationParams } from "@/types/api";
import type { ID } from "@/types/common";
import { compact } from "@/utils";

/**
 * Factory for a conventional REST resource service. Feature modules call this
 * with their DTO types and endpoint to get typed CRUD methods for free, then
 * add domain-specific calls as needed. This keeps transport concerns in the
 * platform and business logic in the feature.
 *
 * `list` returns the full success envelope so callers get both the items
 * (`data`) and pagination (`meta.pagination`); the other methods return the
 * unwrapped entity.
 *
 * ```ts
 * // features/students/api/student.service.ts
 * export const studentService = createResourceService<Student, StudentInput>("/students");
 * ```
 */
export interface ResourceService<TEntity, TInput> {
  list: (params?: PaginationParams) => Promise<ApiResponse<TEntity[]>>;
  get: (id: ID) => Promise<TEntity>;
  create: (input: TInput) => Promise<TEntity>;
  update: (id: ID, input: Partial<TInput>) => Promise<TEntity>;
  remove: (id: ID) => Promise<void>;
}

export function createResourceService<TEntity, TInput>(
  resource: string,
): ResourceService<TEntity, TInput> {
  const base = resource.startsWith("/") ? resource : `/${resource}`;

  return {
    list: (params) =>
      api.getEnvelope<TEntity[]>(base, {
        params: params ? compact(params) : undefined,
      }),
    get: (id) => api.get<TEntity>(`${base}/${id}`),
    create: (input) => api.post<TEntity, TInput>(base, input),
    update: (id, input) =>
      api.patch<TEntity, Partial<TInput>>(`${base}/${id}`, input),
    remove: (id) => api.delete<void>(`${base}/${id}`),
  };
}
