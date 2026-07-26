import { SetMetadata } from '@nestjs/common';

export const MAINTENANCE_FEATURE_KEY = 'maintenance:feature';

/**
 * Decorator to assign a feature name to a route handler or controller.
 * This is used by MaintenanceGuard to check if this specific feature is under maintenance.
 */
export const MaintenanceFeature = (feature: string) =>
  SetMetadata(MAINTENANCE_FEATURE_KEY, feature);
