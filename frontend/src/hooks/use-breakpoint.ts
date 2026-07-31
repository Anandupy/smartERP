"use client";

import { BREAKPOINTS, mediaQuery, type Breakpoint } from "@/constants";

import { useMediaQuery } from "./use-media-query";

/** True when the viewport is at least `breakpoint` wide. */
export function useBreakpoint(breakpoint: Breakpoint): boolean {
  return useMediaQuery(mediaQuery.up(breakpoint));
}

/** Convenience: true below the `tablet` breakpoint. */
export function useIsMobile(): boolean {
  return useMediaQuery(mediaQuery.down("tablet"));
}

export { BREAKPOINTS };
