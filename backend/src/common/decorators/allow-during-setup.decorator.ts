import { SetMetadata } from '@nestjs/common';

export const ALLOW_DURING_SETUP_KEY = 'allowDuringSetup';

/**
 * Permits a route to be called while the workspace is still being bootstrapped.
 *
 * This is not a security bypass: authentication, `@Roles()` and
 * `@RequirePermission()` all still apply. It only exempts the route from the
 * `SETUP_REQUIRED` block, so mark the smallest set of routes that lets an
 * administrator create the first organization, branch and academic year.
 */
export const AllowDuringSetup = () => SetMetadata(ALLOW_DURING_SETUP_KEY, true);
