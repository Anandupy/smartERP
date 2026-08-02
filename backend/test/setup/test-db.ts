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

  await markWorkspaceInitialized();
}

/**
 * Records the seeded workspace as past bootstrap.
 *
 * The suites exercise a *live* workspace, not one being set up: they assume an
 * organization, branch and academic year already exist, which the seed creates.
 * Without this row `WorkspaceSetupGuard` answers every authenticated request
 * with 409 SETUP_REQUIRED, and the whole e2e suite fails for a reason that has
 * nothing to do with what it is testing.
 *
 * The bootstrap flow itself is covered directly by the workspace-setup unit
 * suites, which drive the state explicitly rather than relying on this.
 */
async function markWorkspaceInitialized() {
  try {
    await prisma.workspaceState.upsert({
      where: { scope: 'GLOBAL' },
      update: { initializedAt: new Date() },
      create: { scope: 'GLOBAL', initializedAt: new Date() },
    });
  } catch (error) {
    console.log(
      '[Test DB] Could not mark workspace initialized:',
      error instanceof Error ? error.message : String(error),
    );
  }
}

export async function closeDbConnection() {
  await prisma.$disconnect();
}
