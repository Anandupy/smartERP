import { isDefined } from "./guards";

/** Small, well-typed object/array helpers. */

/** Remove keys whose values are null/undefined (useful for query params). */
export function compact<T extends object>(input: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key of Object.keys(input) as (keyof T)[]) {
    const value = input[key];
    if (isDefined(value)) {
      result[key] = value;
    }
  }
  return result;
}

/** Pick a subset of keys from an object. */
export function pick<T extends object, K extends keyof T>(
  input: T,
  keys: readonly K[],
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in input) result[key] = input[key];
  }
  return result;
}

/** Group array items by a derived string key. */
export function groupBy<T>(
  items: readonly T[],
  keyFn: (item: T) => string,
): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const key = keyFn(item);
    (acc[key] ??= []).push(item);
    return acc;
  }, {});
}
