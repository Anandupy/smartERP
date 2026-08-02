import * as path from 'path';
import { register } from 'tsconfig-paths';

/**
 * Seeds the permission catalogue, module and menu registry into the test
 * database.
 *
 * `.env.test` sets `SEED_ON_BOOTSTRAP=false`, so the application does not seed
 * itself during tests — deliberately, because bootstrap seeding would race with
 * the fixture seeding. Nothing else created this data, so on a freshly migrated
 * database the `Permission` table was empty and every `@RequirePermission`
 * route answered 403, including for SUPER_ADMIN: its bypass grants "all active
 * permissions", and there were none.
 *
 * `SeederService.run()` is reused rather than reproduced so the catalogue the
 * tests run against cannot drift from the one production gets via `pnpm seed`.
 * It is idempotent.
 */
export async function seedReferenceData(): Promise<void> {
  // globalSetup runs outside Jest's transform, so its `moduleNameMapper` does
  // not apply and the `@/` aliases used throughout src/ do not resolve.
  // tsconfig.json declares the aliases relative to the project root rather than
  // through `baseUrl`, so they are restated here.
  const projectRoot = path.join(__dirname, '../..');
  const cleanup = register({
    baseUrl: projectRoot,
    paths: {
      '@/generated/client': ['prisma/generated'],
      '@/*': ['src/*'],
    },
  });

  try {
    const { NestFactory } = await import('@nestjs/core');
    const { AppModule } = await import('../../src/app.module');
    const { SeederService } =
      await import('../../src/infrastructure/database/seeder.service');

    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: false,
    });

    try {
      await app.get(SeederService).run();
      console.log('[Global Setup] Reference data seeded.');
    } finally {
      await app.close();
    }
  } finally {
    cleanup();
  }
}
