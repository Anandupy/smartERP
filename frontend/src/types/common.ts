/** Reusable type primitives used across the whole platform. */

export type Nullable<T> = T | null;
export type Maybe<T> = T | null | undefined;
export type Dictionary<T = unknown> = Record<string, T>;

/** An identifier as returned by the backend (kept opaque on purpose). */
export type ID = string;

/** Deeply readonly view of a value. */
export type DeepReadonly<T> = T extends (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

/** Make selected keys of `T` required. */
export type RequireKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/** A value or a factory that produces it. */
export type ValueOrFactory<T> = T | (() => T);

/** Standard async lifecycle status shared by data-driven UI. */
export type AsyncStatus = "idle" | "loading" | "success" | "error";
