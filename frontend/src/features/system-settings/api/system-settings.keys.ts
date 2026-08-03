import { createQueryKeys } from "@/core/query";

/**
 * Query keys for system settings.
 *
 * The resource is a singleton, so there is exactly one key —
 * `systemSettingsKeys.detail(GLOBAL_SETTINGS)`. Built with the platform factory
 * anyway so the namespace matches every other module and invalidation reads the
 * same everywhere.
 */
export const systemSettingsKeys = createQueryKeys("system-settings");

/** The single record's id, since the backend documents none. */
export const GLOBAL_SETTINGS = "global";
