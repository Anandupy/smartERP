import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';

export const PERMISSION_KEY = 'permissions';
export const PERMISSION_MODE_KEY = 'permission_mode';

export type PermissionMode = 'ALL' | 'ANY';

export interface RequirePermissionOptions {
  mode?: PermissionMode;
}

/**
 * Decorator to require one or more permissions on a controller class or method.
 * Integrates with PermissionGuard and automatically documents OpenAPI metadata.
 *
 * @example @RequirePermission('student.view')
 * @example @RequirePermission(['student.view', 'student.create'], { mode: 'ANY' })
 */
export function RequirePermission(
  permissions: string | string[],
  options: RequirePermissionOptions = {},
) {
  const permList = Array.isArray(permissions) ? permissions : [permissions];
  const mode = options.mode || 'ALL';

  return applyDecorators(
    SetMetadata(PERMISSION_KEY, permList),
    SetMetadata(PERMISSION_MODE_KEY, mode),
    ApiExtension('x-required-permissions', permList),
  );
}
