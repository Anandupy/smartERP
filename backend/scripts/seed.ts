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
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { SeederService } from '../src/infrastructure/database/seeder.service';

async function main() {
  const logger = new Logger('Seed');
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
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seeding failed:', err);
  process.exit(1);
});
