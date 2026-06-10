/**
 * EduOS UI v1 — Active UI version exports.
 *
 * This module is the entry point for the current UI implementation.
 * Routes and pages import from here or directly from sub-paths.
 * Future v2 / v3 UI versions will have their own index.ts with
 * potentially different implementations behind the same interfaces.
 *
 * Version-independent (stores, lib, types, config) remain in src/
 * and are shared across all UI versions.
 */

export * from './components/layout';
