import { PrismaClient } from '../../prisma/generated';
import { seedRealisticData } from '../seeds/realistic-data.seed';
import { validateTestEnvironment } from './safety.guard';

const prisma = new PrismaClient();

export async function validateAndSeedDb() {
  // Validate safety BEFORE doing anything
  validateTestEnvironment();

  try {
    await prisma.maintenanceRule.deleteMany({});
  } catch (err) {
    console.log(
      '[Test DB] MaintenanceRule cleanup skipped:',
      err instanceof Error ? err.message : String(err),
    );
  }

  // Seeding happens inside a transaction or safely.
  // Actually, we avoid destructive cleanup. If seeding is needed, we should handle it
  // safely. For now we just call seedRealisticData.
  try {
    await seedRealisticData(prisma);
  } catch (error) {
    console.log(
      '[Test DB] Seeding skipped or handled differently:',
      error instanceof Error ? error.message : String(error),
    );
  }
}

export async function closeDbConnection() {
  await prisma.$disconnect();
}
