import * as path from 'path';
import { register } from 'tsconfig-paths';

/**
 * Makes the `@/` import aliases resolve when a script boots the Nest app
 * outside `nest start`.
 *
 * Without this, `tsx` loads `src/**` through two different resolutions — the
 * script's relative import chain and the `@/` aliases used inside src/ — so the
 * same file becomes two module instances. Nest then sees a `LoggerService`
 * class that is not the one `LoggerModule` registered, `design:paramtypes`
 * resolves to undefined, and the injected dependency arrives undefined:
 *
 *   TypeError: Cannot read properties of undefined (reading 'setContext')
 *       at new PermissionGuard
 *
 * `tsconfig.json` declares the aliases relative to the project root rather than
 * through `baseUrl`, so they are restated here.
 *
 * Must be called before importing anything from `src/`.
 */
export function registerPathAliases(): () => void {
  return register({
    baseUrl: path.join(__dirname, '..'),
    paths: {
      '@/generated/client': ['prisma/generated'],
      '@/*': ['src/*'],
    },
  });
}
