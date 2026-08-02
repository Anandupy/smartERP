/**
 * Explicit seeder entry point.
 *
 * Production never seeds on boot — see `SeederService.onApplicationBootstrap`.
 * This is the supported way to populate the permission catalogue, module and
 * menu registry, and (when ADMIN_EMAIL / ADMIN_PASSWORD are set) the initial
 * Super Admin on a production database.
 *
 *   pnpm seed
 *
 * Seeding is idempotent, so re-running it is safe.
 */
import { Logger } from '@nestjs/common';
import { registerPathAliases } from './register-paths';

async function main() {
  // Must precede any import from src/ — see register-paths.ts.
  const cleanup = registerPathAliases();
  const logger = new Logger('Seed');

  try {
    const { NestFactory } = await import('@nestjs/core');
    const { AppModule } = await import('../src/app.module');
    const { SeederService } =
      await import('../src/infrastructure/database/seeder.service');

    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn', 'log'],
    });

    try {
      logger.log(`Seeding (${process.env.NODE_ENV ?? 'development'})...`);
      await app.get(SeederService).run();
      logger.log('Seeding completed.');
    } finally {
      await app.close();
    }
  } finally {
    cleanup();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seeding failed:', err);
  process.exit(1);
});
