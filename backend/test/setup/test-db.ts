import { PrismaClient } from '../../prisma/generated';
import { seedRealisticData } from '../seeds/realistic-data.seed';
import { validateTestEnvironment } from './safety.guard';

const prisma = new PrismaClient();

export async function validateAndSeedDb() {
  // Validate safety BEFORE doing anything
  validateTestEnvironment();

  // Seeding happens inside a transaction or safely.
  // Actually, we avoid destructive cleanup. If seeding is needed, we should handle it
  // safely. For now we just call seedRealisticData.
  try {
    await seedRealisticData(prisma);
  } catch (error) {
    console.log(
      '[Test DB] Seeding skipped or handled differently:',
      error.message,
    );
  }
}

export async function closeDbConnection() {
  await prisma.$disconnect();
}
